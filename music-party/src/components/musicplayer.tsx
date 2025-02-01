import {
  Button,
  Flex,
  Icon,
  IconButton,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Progress,
  Text,
  Tooltip,
  useDisclosure,
  useToast,
  Slider,
  SliderTrack,
  SliderFilledTrack,
  SliderThumb,
  Image,
  Box,
  Heading,
  SliderMark,
} from "@chakra-ui/react";
import { ArrowRightIcon } from "@chakra-ui/icons";
import React, { useEffect, useRef, useState } from "react";

interface MusicPlayerProps {
  src: string;
  playtime: number;
  nextClick: () => void;
  reset: () => void;
  imageUrl: string;
  nowPlaying?: {
    songName: string;
    artist: string;
    requester: string;
  };
}

export const MusicPlayer = (props: MusicPlayerProps) => {
  const audio = useRef<HTMLAudioElement>();
  const [length, setLength] = useState(100);
  const [time, setTime] = useState(0);
  const t = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [volume, setVolume] = useState(0.5);  // 音量值（范围 0 到 1）
  const [isDragging, setIsDragging] = useState(false);

  // 格式化时间函数
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);  // 计算分钟数
    const secs = Math.floor(seconds % 60);    // 计算秒数

    return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;  // 使用 padStart 保证格式为 00:00
  };

  useEffect(() => {
    if (audio.current) {
      // 音量值从 0 到 100，映射到 0 到 1 的范围
      audio.current.volume = volume;
    }
  }, [volume]);

  useEffect(() => {
    // 尝试从 localStorage 获取音量值，若没有，则使用默认值
    const savedVolume = localStorage.getItem("musicPlayerVolume");
    if (savedVolume) {
      setVolume(parseFloat(savedVolume));  // 设置从 localStorage 获取的音量
    }

    if (!audio.current) {
      audio.current = new Audio();
      audio.current.addEventListener("durationchange", () => {
        setLength(audio.current!.duration);
      });
      audio.current.addEventListener("timeupdate", () => {
        setTime(audio.current!.currentTime);
      });
      audio.current.volume = volume;  // 设置初始音量
    }
    if (props.src === "") return;
    audio.current.src = props.src;
    if (props.playtime !== 0) audio.current.currentTime = props.playtime;
    audio.current.play().catch((e: DOMException) => {
      if (
        e.message ===
        "The play() request was interrupted because the media was removed from the document."
      )
        return;
      console.log(e);
      onOpen();
    });
  }, [props.src, props.playtime]);

  // 音量变化时更新音量值和 audio 元素的音量
  const handleVolumeChange = (value: number) => {
    setVolume(value / 100);  // 将音量值从 0-100 转换到 0-1
    if (audio.current) {
      audio.current.volume = value / 100;  // 更新音频的音量
      // 保存音量到 localStorage
      localStorage.setItem("musicPlayerVolume", (value / 100).toString());
    }
  };
  
  return (
    <Box position="relative" mb={6}>
      {/* 图片和主内容区域 */}
      <Flex direction={["column", "row"]} align="stretch">
        {/* 封面图片 - 手机端占满宽度 */}
        <Box width={["100%", "180px"]} mr={[0, 4]} mb={[4, 0]}>
          <Image
            src={props.imageUrl || "https://i0.hdslb.com/bfs/static/jinkela/video/asserts/no_video.png"}
            alt="歌曲封面"
            boxSize={["200px", "160px"]}  // 手机端稍大
            objectFit="contain"
            mx="auto"  // 手机端水平居中
          />
        </Box>

        {/* 右侧内容 - 手机端全宽度 */}
        <Flex direction="column" flex={1} justifyContent="space-between">
          {/* 标题信息调整文字对齐方式 */}
          <Box textAlign={["center", "left"]}>
            {props.nowPlaying ? (
              <>
                <Heading fontSize={["xl", "2xl"]} lineHeight="short">
                  {props.nowPlaying.songName}
                </Heading>
                <Text fontSize={["md", "lg"]}>
                  -- {props.nowPlaying.artist}
                </Text>
                <Text fontSize="sm" color="brand.100" mt={1}>
                  点歌人: {props.nowPlaying.requester}
                </Text>
              </>
            ) : (
              <Heading fontSize={["xl", "2xl"]} lineHeight="short">
                暂无歌曲正在播放
              </Heading>
            )}
          </Box>

          {/* 进度条控制区域 - 调整为垂直堆叠 */}
          <Flex direction={["column", "row"]} align="center" mt={4}>
            <Flex direction="row" align="center" flex={1} width="100%">
              <Progress
                flex={1}
                height="32px"
                max={length}
                value={time}
                mr={[2, 4]}  // 手机端减少右边距
              />
              <Text flex={["0 0 80px", "0 0 100px"]} textAlign="center" fontSize={["sm", "md"]}>
                {`${formatTime(time)} / ${formatTime(length)}`}
              </Text>
            </Flex>

            {/* 控制按钮调整为始终在右侧 */}
            <Flex gap={2} mt={[2, 0]} ml={[0, 4]} width={["100%", "auto"]} justifyContent={["center", "flex-start"]}>
              <Tooltip hasArrow label="当音乐没有自动播放时，点我试试">
                <IconButton
                  aria-label="Play"
                  icon={
                    <Icon viewBox="0 0 1024 1024">
                      <path
                        d="M128 138.666667c0-47.232 33.322667-66.666667 74.176-43.562667l663.146667 374.954667c40.96 23.168 40.853333 60.8 0 83.882666L202.176 928.896C161.216 952.064 128 932.565333 128 885.333333v-746.666666z"
                        fill="#3D3D3D"
                        p-id="2949"
                      ></path>
                    </Icon>
                  }
                  size={["sm", "md"]}
                  onClick={() => {
                    audio.current?.play();
                    audio.current?.pause();
                    props.reset();
                  }}
                />
              </Tooltip>
              <Tooltip hasArrow label="切歌">
                <IconButton
                  icon={<ArrowRightIcon />}
                  aria-label="切歌"
                  size={["sm", "md"]}
                />
              </Tooltip>
            </Flex>
          </Flex>
        </Flex>
      </Flex>

      {/* 独立音量控制行 */}
      <Flex direction="row" align="center" mt={4} width="100%">
        <Text width={["60px", "40px"]} flexShrink={0}>音量</Text>
        <Slider
          value={volume * 100}
          onChange={handleVolumeChange}
          flex={1}
          ml={[2, 4]}
          onMouseDown={() => setIsDragging(true)}
          onMouseUp={() => setIsDragging(false)}
          min={0}
          max={100}
          step={1}
        >
          <SliderTrack>
            <SliderFilledTrack />
          </SliderTrack>
          {isDragging && (
            <SliderMark
              value={volume * 100}
              textAlign="center"
              bg="blue.500"
              color="white"
              mt="-8"
              ml="-5"
              w="10"
              borderRadius="md"
            >
              {Math.round(volume * 100)}
            </SliderMark>
          )}
          <SliderThumb />
        </Slider>
      </Flex>

      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay>
          <ModalContent>
            <ModalHeader fontSize={"lg"} fontWeight={"bold"}>
              Error
            </ModalHeader>
            <ModalBody>
              <Text>
                看起来你的浏览器不允许音频自动播放，
                请点击下方的按钮来启用自动播放~
              </Text>
            </ModalBody>
            <ModalFooter>
              <Button
                colorScheme={"blue"}
                onClick={() => {
                  audio.current?.play();
                  props.reset();
                  onClose();
                }}
              >
                启用自动播放
              </Button>
            </ModalFooter>
          </ModalContent>
        </ModalOverlay>
      </Modal>
    </Box>
  );
};
