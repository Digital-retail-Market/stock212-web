import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Container, Flex, Heading, HStack, Image, Text } from '@chakra-ui/react';
import { ArrowRight, Play } from 'lucide-react';

const NAVY = '#0d1f38';
const AMBER_BORDER = '#fbbf24';

// ── Full-width promo banner ───────────────────────────────────────────────────
// Placeholder gradient until `image` is supplied; pass an image URL to replace it.
export function PromoBanner({ title, subtitle, cta = 'Découvrir', to = '/catalog', image, from = NAVY, via = '#13294a', toColor = '#1a3558' }: {
  title: string; subtitle?: string; cta?: string; to?: string; image?: string;
  from?: string; via?: string; toColor?: string;
}) {
  const navigate = useNavigate();
  return (
    <Box position="relative" overflow="hidden" cursor="pointer" onClick={() => navigate(to)}
      minH={{ base: '130px', md: '190px' }}
      style={{ background: image ? NAVY : `linear-gradient(120deg, ${from} 0%, ${via} 55%, ${toColor} 100%)` }}>
      {image && <Image src={image} alt={title} position="absolute" inset={0} w="full" h="full" objectFit="cover" />}
      <Container maxW="1400px" position="relative" py={{ base: 6, md: 10 }}>
        <Flex align="center" justify="space-between" gap={4} direction={{ base: 'column', md: 'row' }}
          textAlign={{ base: 'center', md: 'start' }}>
          <Box>
            <Heading size={{ base: 'lg', md: 'xl' }} color="white" fontWeight="900" textTransform="uppercase">{title}</Heading>
            {subtitle && <Text color="rgba(255,255,255,0.8)" mt={1} fontSize={{ base: 'sm', md: 'md' }}>{subtitle}</Text>}
          </Box>
          <Button h={{ base: '44px', md: 10 }} bg={AMBER_BORDER} color={NAVY} fontWeight="800" rightIcon={<ArrowRight size={16} />}
            _hover={{ bg: 'white' }} flexShrink={0}>
            {cta}
          </Button>
        </Flex>
      </Container>
    </Box>
  );
}

// ── Full-width inline video with a switcher ──────────────────────────────────
export interface ShowcaseVideo { id: string; title: string }

export function VideoShowcase({ videos }: { videos: ShowcaseVideo[] }) {
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(false);
  const current = videos[active];
  if (!current) return null;
  const thumb = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
  const select = (i: number) => { setActive(i); setPlaying(true); };

  return (
    <Box bg={NAVY} py={{ base: 6, md: 10 }}>
      <Container maxW="1400px">
        <Box position="relative" w="full" rounded="xl" overflow="hidden" bg="black" style={{ aspectRatio: '16/9', maxHeight: '70vh' }}>
          {playing ? (
            <iframe key={current.id} title={current.title}
              src={`https://www.youtube.com/embed/${current.id}?autoplay=1&mute=1&rel=0`}
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }} />
          ) : (
            <Flex as="button" type="button" aria-label={`Lire ${current.title}`} onClick={() => setPlaying(true)}
              position="absolute" inset={0} align="center" justify="center" w="full" h="full">
              <Image src={thumb(current.id)} alt="" position="absolute" inset={0} w="full" h="full" objectFit="cover" opacity={0.7} />
              <Flex position="relative" w={20} h={20} rounded="full" align="center" justify="center" bg={AMBER_BORDER} color={NAVY}>
                <Play size={32} fill="currentColor" />
              </Flex>
            </Flex>
          )}
        </Box>
        {videos.length > 1 && (
          <HStack spacing={3} mt={4} overflowX="auto" pb={1}>
            {videos.map((v, i) => (
              <Box key={v.id} as="button" type="button" onClick={() => select(i)} flexShrink={0} w={{ base: '140px', md: '200px' }}
                rounded="md" overflow="hidden" textAlign="start" border="2px solid"
                borderColor={i === active ? AMBER_BORDER : 'transparent'} opacity={i === active ? 1 : 0.7}
                _hover={{ opacity: 1 }}>
                <Image src={thumb(v.id)} alt="" w="full" style={{ aspectRatio: '16/9' }} objectFit="cover" />
                <Text color="white" fontSize="xs" fontWeight="600" p={2} noOfLines={1}>{v.title}</Text>
              </Box>
            ))}
          </HStack>
        )}
      </Container>
    </Box>
  );
}
