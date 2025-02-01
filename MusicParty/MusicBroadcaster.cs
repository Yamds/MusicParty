using Microsoft.AspNetCore.SignalR;
using MusicParty.Hub;
using MusicParty.MusicApi;

namespace MusicParty;

// 音乐广播系统核心类，负责管理播放队列和播放状态
public class MusicBroadcaster
{
    // 当前播放信息（音乐对象、点播用户ID）
    public (PlayableMusic music, string service, string enqueuerId)? NowPlaying { get; private set; }
    
    // 使用自定义的可置顶队列存储待播放音乐
    private ToppableQueue<MusicOrderAction> MusicQueue { get; } = new();
    
    // 当前歌曲开始播放的时间
    public DateTime NowPlayingStartedTime { get; private set; }
    private readonly IEnumerable<IMusicApi> _apis;
    private readonly IHubContext<MusicHub> _context;
    private readonly UserManager _userManager;
    private readonly ILogger<MusicBroadcaster> _logger;

    // 新增循环模式字段
    public bool _loopMode = true;

    private List<MusicQueueItem> _queue = new();  // 假设已有队列定义
    private readonly object _queueLock = new();    // 队列操作锁

    public class MusicQueueItem
    {
        public string ActionId { get; set; }
        public PlayableMusic Music { get; set; }
        public string ServiceName { get; set; }
        public string EnqueuerId { get; set; }
    }

    // 构造函数：初始化音乐API、SignalR Hub等依赖项
    public MusicBroadcaster(IEnumerable<IMusicApi> apis, IHubContext<MusicHub> context, UserManager userManager,
        ILogger<MusicBroadcaster> logger)
    {
        _apis = apis;
        _context = context;
        _userManager = userManager;
        _logger = logger;
        Task.Run(Loop);
    }

    // 主循环：持续监控播放状态和音乐队列
    private async Task Loop()
    {
        while (true)
        {
            if (NowPlaying is null)
            {
                // 从队列中取出下一首音乐进行播放
                if (MusicQueue.TryDequeue(out var musicOrder))
                {
                    await MusicDequeued();
                    if (!_apis.TryGetMusicApi(musicOrder.Service, out var ma))
                    {
                        _logger.LogError(new ArgumentException($"Unknown api provider {musicOrder.Service}",
                                nameof(musicOrder.Service)), "{MusicId} with {Api} play failed, skipping...",
                            musicOrder.Music.Id, musicOrder.Service);
                        continue;
                    }

                    for (var i = 0;; i++) // try 3 times before skip.
                    {
                        try
                        {
                            var music = await ma!.GetPlayableMusicAsync(musicOrder.Music);
                            NowPlaying = (music, musicOrder.Service, musicOrder.EnqueuerId);
                            if (music.NeedProxy)
                            {
                                await MusicProxyMiddleware.StartProxyAsync(new MusicProxyRequest(music.TargetUrl!,
                                    "audio/mp4", music.Referer,
                                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36 Edg/109.0.1518.78"));
                            }

                            NowPlayingStartedTime = DateTime.Now;
                            await SetNowPlaying(NowPlaying.Value.music,
                                _userManager.FindUserById(musicOrder.EnqueuerId)!.Name);
                            break;
                        }
                        catch (Exception ex)
                        {
                            if (i >= 2) // failed 3 times, skip.
                            {
                                _logger.LogError(ex, "{MusicId} with {Api} play failed, skipping...",
                                    musicOrder.Music.Id, musicOrder.Service);
                                await GlobalMessage($"Failed to play {musicOrder.Music.Name}, skip to next music.");
                                break;
                            }
                        }
                    }
                }
            }
            else
            {
                // 检查当前歌曲是否播放完毕
                if ((DateTime.Now - NowPlayingStartedTime).TotalMilliseconds >= NowPlaying.Value.music.Length)
                {
                    // 新增循环播放逻辑
                    if (_loopMode)  // 需要先声明循环模式字段
                    {
                        // 将当前歌曲重新加入队列
                        var current = NowPlaying.Value;
                        await EnqueueMusic(current.music, current.service, current.enqueuerId);
                    }
                    
                    NowPlaying = null; // 强制结束当前播放
                }
            }

            await Task.Delay(1000); // 每秒检查一次状态
        }
    }

    // 获取当前播放队列
    public IEnumerable<MusicOrderAction> GetQueue() => MusicQueue;

    // 添加音乐到队列
    public async Task EnqueueMusic(Music music, string apiName, string enqueuerId)
    {
        var action = new MusicOrderAction(Guid.NewGuid().ToString()[..8], music, apiName, enqueuerId);

        MusicQueue.Enqueue(action);

        await MusicEnqueued(action.ActionId, music, _userManager.FindUserById(enqueuerId)!.Name);
    }
    public async Task SetLoopMode(bool content)
    {
        _loopMode = content;
        await _context.Clients.All.SendAsync(nameof(SetLoopMode), content);
        
        // 新增：当模式改变时通知所有客户端
        await _context.Clients.All.SendAsync("ReceiveLoopModeStatus", _loopMode);
    }

    // 切歌处理（支持循环模式）
    public async Task NextSong(string operatorId)
    {
        if (NowPlaying is null) return;
        await MusicCut(operatorId, NowPlaying.Value.music);
        NowPlaying = null; // 强制结束当前播放
    }

    // 置顶队列中的指定歌曲
    public async Task TopSong(string actionId, string operatorId)
    {
        MusicQueue.TopItem(x => x.ActionId == actionId);
        await MusicTopped(actionId, _userManager.FindUserById(operatorId)!.Name);
    }

    // 私有方法：向客户端推送状态更新 -------------------------
    
    // 更新当前播放信息
    private async Task SetNowPlaying(PlayableMusic music, string enqueuerName)
    {
        await _context.Clients.All.SendAsync(nameof(SetNowPlaying), music, enqueuerName, 0);
    }

    // 通知新音乐加入队列
    private async Task MusicEnqueued(string actionId, Music music, string enqueuerName)
    {
        await _context.Clients.All.SendAsync(nameof(MusicEnqueued), actionId, music, enqueuerName);
    }

    // 通知音乐出队（开始播放）
    private async Task MusicDequeued()
    {
        await _context.Clients.All.SendAsync(nameof(MusicDequeued));
    }

    // 通知歌曲被置顶
    private async Task MusicTopped(string actionId, string operatorName)
    {
        await _context.Clients.All.SendAsync(nameof(MusicTopped), actionId, operatorName);
    }

    // 通知切歌操作
    private async Task MusicCut(string operatorId, Music music)
    {
        await _context.Clients.All.SendAsync(nameof(MusicCut), _userManager.FindUserById(operatorId)!.Name, music);
    }

    // 发送全局消息通知
    private async Task GlobalMessage(string content)
    {
        await _context.Clients.All.SendAsync(nameof(GlobalMessage), content);
    }

    // 内部数据记录类型 -------------------------
    public record MusicOrderAction(string ActionId, Music Music, string Service, string EnqueuerId);

    // 自定义可置顶队列实现
    private class ToppableQueue<T> : LinkedList<T>
    {
        // 将满足条件的项目置顶
        public void TopItem(Func<T, bool> pred)
        {
            if (Count == 1)
                return;
            var node = Find(this.First(pred))!; // if count == 0, this will throw an exception.
            Remove(node);
            AddBefore(First!, node);
        }

        // 入队操作（添加到队尾）
        public void Enqueue(T item)
        {
            AddLast(item);
        }

        // 出队操作（从队首移除）
        public bool TryDequeue(out T? item)
        {
            if (Count == 0)
            {
                item = default;
                return false;
            }
            else
            {
                item = First!.Value;
                RemoveFirst();
                return true;
            }
        }
    }

    // 新增循环模式方法
    public void ToggleLoopMode()
    {
        _loopMode = !_loopMode;
    }

    public void DeleteSong(string actionId)
    {
        lock (MusicQueue)
        {
            // 从队列中移除指定actionId的歌曲
            var itemToRemove = MusicQueue.FirstOrDefault(x => x.ActionId == actionId);
            if (itemToRemove != null)
            {
                MusicQueue.Remove(itemToRemove);
                _logger.LogInformation($"歌曲 {itemToRemove.Music.Name} 已被删除");
            }
        }
    }

    public string GetMusicName(string actionId)
    {
        var item = MusicQueue.FirstOrDefault(x => x.ActionId == actionId);
        return item?.Music.Name ?? string.Empty;
    }
}