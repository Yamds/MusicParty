import { TriangleUpIcon } from '@chakra-ui/icons';
import {
  Text,
  Card,
  CardHeader,
  Heading,
  CardBody,
  OrderedList,
  ListItem,
  Box,
  Highlight,
  Flex,
  Tooltip,
  IconButton,
  HStack,
  Switch
} from '@chakra-ui/react';
import { MusicOrderAction } from '../api/musichub';

interface MusicQueueProps {
  queue: MusicOrderAction[];
  top: (actionId: string) => void;
  loopMode: boolean;
  toggleLoopMode: (checked: boolean) => void;
}

export const MusicQueue = (props: MusicQueueProps) => {


  return (
    <Card mt={4}>
      <CardHeader>
        <Flex justifyContent="space-between" alignItems="center" width="full">
          <Heading size={'lg'}>播放队列</Heading>
          <HStack spacing={2}>
            <Text fontSize="sm" color="gray.500">循环模式</Text>
            <Switch 
              colorScheme="blue"
              size="md"
              isChecked={props.loopMode}
              onChange={(e) => props.toggleLoopMode(e.target.checked)}
            />
          </HStack>
        </Flex>
      </CardHeader>
      <CardBody>
        <OrderedList>
          {props.queue.length > 0 ? (
            props.queue.map((v) => (
              <ListItem key={v.actionId} fontSize={'lg'}>
                <Flex>
                  <Box flex={1}>
                    {v.music.name} - {v.music.artists}
                    <Text fontSize={'sm'} fontStyle={'italic'}>
                      由 {v.enqueuerName} 点歌
                    </Text>
                  </Box>
                  {props.queue.findIndex((x) => x.actionId === v.actionId) !==
                    0 && (
                    <Tooltip hasArrow label={'将此歌曲至于队列顶端'}>
                      <IconButton
                        onClick={() => props.top(v.actionId)}
                        aria-label={'置顶'}
                        icon={<TriangleUpIcon />}
                      />
                    </Tooltip>
                  )}
                </Flex>
              </ListItem>
            ))
          ) : (
            <Text size={'md'}>
              <Highlight
                query={'点歌'}
                styles={{ px: '2', py: '1', rounded: 'full', bg: 'teal.100' }}
              >
                播放队列为空，请随意点歌吧~
              </Highlight>
            </Text>
          )}
        </OrderedList>
      </CardBody>
    </Card>
  );
};
