import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { rememberSignupRole } from '../../lib/signupRole';
import {
  Box, Button, Flex, FormControl, FormLabel, Heading, Input,
  Text, VStack, HStack, Alert, AlertIcon, useToast, Image,
  InputGroup, InputRightElement, InputLeftElement, IconButton,
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter,
  useDisclosure, Divider,
} from '@chakra-ui/react';
import {
  Eye, EyeOff, Mail, Lock, User,
  Shield, CheckCircle, Globe, TrendingUp, ArrowRight,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

// ─── Forgot password modal ────────────────────────────────────────────────────
function ForgotPasswordModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const toast = useToast();

  async function handleReset() {
    if (!email) return;
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    setLoading(false);
    if (error) {
      toast({ title: 'Erreur', description: error.message, status: 'error', duration: 4000 });
    } else {
      setSent(true);
    }
  }

  function handleClose() {
    setSent(false);
    setEmail('');
    onClose();
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} isCentered size="sm">
      <ModalOverlay backdropFilter="blur(4px)" />
      <ModalContent rounded="md" p={2}>
        <ModalHeader>
          <VStack spacing={1} align="start">
            <Text fontWeight="700" color="gray.800" fontSize="md">Réinitialisation du mot de passe</Text>
            <Text fontSize="sm" color="gray.500" fontWeight="normal">
              Renseignez votre adresse e-mail professionnelle.
            </Text>
          </VStack>
        </ModalHeader>
        <ModalBody>
          {sent ? (
            <VStack spacing={3} py={4} textAlign="center">
              <Flex w={12} h={12} bg="green.50" border="1px" borderColor="green.200"
                rounded="md" align="center" justify="center" mx="auto">
                <CheckCircle size={24} color="var(--chakra-colors-green-600)" />
              </Flex>
              <Text fontWeight="600" color="gray.800">Lien envoyé</Text>
              <Text fontSize="sm" color="gray.500" lineHeight={1.6}>
                Vérifiez votre boîte de réception et suivez les instructions du message.
              </Text>
            </VStack>
          ) : (
            <FormControl>
              <InputGroup>
                <InputLeftElement pointerEvents="none">
                  <Mail size={15} color="gray" />
                </InputLeftElement>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="vous@entreprise.com"
                  rounded="sm"
                  fontSize="sm"
                />
              </InputGroup>
            </FormControl>
          )}
        </ModalBody>
        <ModalFooter gap={2}>
          <Button variant="ghost" onClick={handleClose} rounded="md" size="sm">Annuler</Button>
          {!sent && (
            <Button
              colorScheme="blue"
              onClick={handleReset}
              isLoading={loading}
              rounded="md"
              size="sm"
              rightIcon={<ArrowRight size={13} />}
            >
              Envoyer le lien
            </Button>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

// ─── Brand panel (left side) ──────────────────────────────────────────────────
function BrandPanel() {
  return (
    <Flex
      direction="column"
      bg="blue.900"
      color="white"
      p={{ base: 8, md: 12 }}
      justify="space-between"
      position="relative"
      overflow="hidden"
      minH={{ base: 'auto', md: '100vh' }}
    >
      {/* Geometric background accents */}
      <Box
        position="absolute" top={0} right={0}
        w="0" h="0"
        style={{
          borderLeft: '300px solid transparent',
          borderTop: '300px solid rgba(255,255,255,0.03)',
        }}
      />
      <Box
        position="absolute" bottom={0} left={0}
        w="200px" h="200px"
        bg="blue.800"
        style={{ clipPath: 'polygon(0 100%, 100% 100%, 0 0)' }}
      />

      {/* Logo */}
      <HStack spacing={3} position="relative" mb={8}>
        <Image src="/navlogo_white.png" alt="Stock212" h="36px" w="auto" objectFit="contain" flexShrink={0} />
        <Box>
          <Text fontWeight="800" fontSize="lg" lineHeight={1} letterSpacing="-0.02em">Stock212</Text>
          <Text fontSize="11px" color="blue.300" letterSpacing="0.06em" textTransform="uppercase">
            Plateforme B2B FMCG
          </Text>
        </Box>
      </HStack>

      {/* Headline */}
      <VStack align="start" spacing={5} position="relative" flex={1} justify="center">
        <Box>
          <Text fontSize="xs" color="blue.300" fontWeight="600" letterSpacing="0.1em"
            textTransform="uppercase" mb={2}>
            Marketplace professionnelle
          </Text>
          <Heading size="xl" lineHeight={1.15} fontWeight="800" letterSpacing="-0.02em">
            L'approvisionnement FMCG<br />
            <Text as="span" color="blue.300">structuré pour les pros.</Text>
          </Heading>
        </Box>
        <Text color="blue.200" fontSize="sm" lineHeight={1.8} maxW="320px">
          Accédez à un réseau de fournisseurs vérifiés, des conditions tarifaires négociées
          et des outils de gestion des achats adaptés aux professionnels.
        </Text>

        {/* Trust indicators */}
        <VStack align="start" spacing={3} mt={2}>
          {[
            { Icon: Shield, text: 'Fournisseurs 100% vérifiés (SIRET, certifications)' },
            { Icon: Globe, text: 'Couverture France, Maroc, Afrique francophone' },
            { Icon: TrendingUp, text: '10 000+ références actives dans le catalogue' },
          ].map(({ Icon, text }) => (
            <HStack key={text} spacing={3}>
              <Flex
                w={7} h={7}
                bg="blue.800"
                border="1px" borderColor="blue.700"
                rounded="sm"
                align="center" justify="center"
                flexShrink={0}
              >
                <Icon size={13} color="var(--chakra-colors-blue-300)" />
              </Flex>
              <Text fontSize="xs" color="blue.200" lineHeight={1.5}>{text}</Text>
            </HStack>
          ))}
        </VStack>
      </VStack>

      {/* Testimonial block */}
      <Box
        position="relative"
        bg="blue.800"
        border="1px"
        borderColor="blue.700"
        rounded="md"
        p={5}
        mt={8}
      >
        <Box
          w={1} h="full"
          bg="blue.400"
          position="absolute"
          left={0} top={0} bottom={0}
          rounded="full"
        />
        <Text fontSize="sm" color="blue.100" lineHeight={1.7} pl={3}>
          "Stock212 a rationalisé notre processus d'approvisionnement. Réduction des coûts de 28%
          et délais de livraison maîtrisés sur nos commandes récurrentes."
        </Text>
        <HStack mt={3} spacing={2} pl={3}>
          <Flex
            w={7} h={7}
            bg="blue.600"
            rounded="sm"
            align="center" justify="center"
          >
            <Text fontSize="10px" fontWeight="700">AM</Text>
          </Flex>
          <Box>
            <Text fontSize="xs" fontWeight="600">Ahmed M.</Text>
            <Text fontSize="10px" color="blue.300">Directeur Achats · Casablanca</Text>
          </Box>
        </HStack>
      </Box>
    </Flex>
  );
}

// ─── AuthPage ─────────────────────────────────────────────────────────────────
export default function AuthPage() {
  // /auth?mode=signup ouvre directement l'onglet inscription.
  const [mode, setMode] = useState<'signin' | 'signup'>(
    () => (new URLSearchParams(window.location.search).get('mode') === 'signup' ? 'signup' : 'signin'),
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [signupConfirmSent, setSignupConfirmSent] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();
  const { isOpen: isForgotOpen, onOpen: openForgot, onClose: closeForgot } = useDisclosure();
  // /auth?role=seller (bouton « Connexion fournisseur ») : « Vendeur » sera présélectionné à l'onboarding.
  const isSupplier = useSearchParams()[0].get('role') === 'seller';

  useEffect(() => {
    if (isSupplier) rememberSignupRole('seller');
  }, [isSupplier]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } },
        });
        if (error) throw error;

        if (data.session) {
          // Confirmation email désactivée (ou déjà confirmée) : la personne est
          // immédiatement connectée, on l'envoie directement choisir son rôle.
          navigate('/onboarding');
        } else {
          // Confirmation email requise : on ne peut pas continuer tant que le lien
          // n'a pas été cliqué. On l'affiche clairement au lieu de la laisser sur
          // le même formulaire sans indication.
          setSignupConfirmSent(true);
          toast({
            title: 'Vérifiez votre e-mail',
            description: 'Cliquez sur le lien de confirmation pour continuer votre inscription.',
            status: 'success',
            duration: 6000,
          });
        }
     } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Flex minH="100vh" bg="gray.50">
      {/* Left brand panel — hidden on small screens */}
      <Box w="42%" display={{ base: 'none', lg: 'block' }} flexShrink={0}>
        <BrandPanel />
      </Box>

      {/* Right form panel */}
      <Flex
        flex={1}
        align="center"
        justify="center"
        p={{ base: 6, md: 10 }}
        bg="white"
        overflowY="auto"
        minH="100vh"
      >
        <Box w="full" maxW="400px">
          {/* Mobile logo */}
          <HStack spacing={3} mb={8} display={{ base: 'flex', lg: 'none' }}>
            <Image src="/navlogo.png" alt="Stock212" h="32px" w="auto" objectFit="contain" flexShrink={0} />
            <Box>
              <Text fontWeight="800" fontSize="md" color="gray.900" lineHeight={1}
                letterSpacing="-0.02em">Stock212</Text>
              <Text fontSize="10px" color="gray.500" textTransform="uppercase"
                letterSpacing="0.06em">Plateforme B2B FMCG</Text>
            </Box>
          </HStack>

          {/* Headline */}
          <VStack align="start" spacing={1} mb={7}>
            <Heading size="md" color="gray.900" fontWeight="700" letterSpacing="-0.01em">
              {mode === 'signin'
                ? (isSupplier ? 'Connexion à votre espace fournisseur' : 'Connexion à votre espace')
                : (isSupplier ? 'Devenir fournisseur' : 'Demander un accès')}
            </Heading>
            <Text color="gray.500" fontSize="sm" lineHeight={1.6}>
              {mode === 'signin'
                ? 'Accédez à votre tableau de bord professionnel'
                : 'Déposez votre dossier d\'entreprise pour accéder à la plateforme'}
            </Text>
          </VStack>

          {/* Mode toggle */}
          <HStack bg="gray.100" p="3px" rounded="md" mb={7} spacing={0}>
            {(['signin', 'signup'] as const).map((m) => (
              <Button
                key={m}
                flex={1}
                size="sm"
                variant={mode === m ? 'solid' : 'ghost'}
                colorScheme={mode === m ? 'blue' : 'gray'}
                bg={mode === m ? 'white' : 'transparent'}
                shadow={mode === m ? 'sm' : undefined}
                rounded="sm"
                fontWeight="600"
                fontSize="xs"
                transition="all 0.15s"
                onClick={() => { setMode(m); setError(''); setSignupConfirmSent(false); }}
              >
                {m === 'signin' ? 'Connexion' : 'Nouvel accès'}
              </Button>
            ))}
          </HStack>

          {signupConfirmSent ? (
            <VStack
              spacing={4}
              align="center"
              textAlign="center"
              bg="blue.50"
              border="1px"
              borderColor="blue.100"
              rounded="md"
              p={6}
            >
              <Flex w={12} h={12} bg="blue.100" rounded="full" align="center" justify="center">
                <Mail size={22} color="var(--chakra-colors-blue-600)" />
              </Flex>
              <Box>
                <Text fontWeight="700" color="gray.800" fontSize="sm" mb={1}>
                  Vérifiez votre e-mail
                </Text>
                <Text fontSize="sm" color="gray.600" lineHeight={1.6}>
                  Un lien de confirmation a été envoyé à <strong>{email}</strong>. Cliquez dessus,
                  puis revenez ici pour vous connecter et choisir votre rôle.
                </Text>
              </Box>
              <Button
                size="sm"
                variant="ghost"
                colorScheme="blue"
                onClick={() => { setSignupConfirmSent(false); setMode('signin'); }}
              >
                J'ai confirmé, me connecter
              </Button>
            </VStack>
          ) : (
            <>
          {error && (
            <Alert status="error" rounded="sm" mb={4} fontSize="sm">
              <AlertIcon />
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            <VStack spacing={4}>
              {mode === 'signup' && (
                <FormControl isRequired>
                  <FormLabel fontSize="xs" color="gray.600" fontWeight="600"
                    textTransform="uppercase" letterSpacing="0.05em">
                    Nom complet
                  </FormLabel>
                  <InputGroup>
                    <InputLeftElement pointerEvents="none">
                      <User size={14} color="gray" />
                    </InputLeftElement>
                    <Input
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Prénom Nom"
                      rounded="sm"
                      fontSize="sm"
                      bg="white"
                      border="1px"
                      borderColor="gray.200"
                      _focus={{ bg: 'white', borderColor: 'blue.500' }}
                    />
                  </InputGroup>
                </FormControl>
              )}

              <FormControl isRequired>
                <FormLabel fontSize="xs" color="gray.600" fontWeight="600"
                  textTransform="uppercase" letterSpacing="0.05em">
                  E-mail professionnel
                </FormLabel>
                <InputGroup>
                  <InputLeftElement pointerEvents="none">
                    <Mail size={14} color="gray" />
                  </InputLeftElement>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="vous@entreprise.com"
                    rounded="sm"
                    fontSize="sm"
                    bg="white"
                    border="1px"
                    borderColor="gray.200"
                    _focus={{ bg: 'white', borderColor: 'blue.500' }}
                  />
                </InputGroup>
              </FormControl>

              <FormControl isRequired>
                <Flex justify="space-between" align="center" mb={1}>
                  <FormLabel fontSize="xs" color="gray.600" fontWeight="600"
                    textTransform="uppercase" letterSpacing="0.05em" mb={0}>
                    Mot de passe
                  </FormLabel>
                  {mode === 'signin' && (
                    <Button
                      variant="link"
                      colorScheme="blue"
                      fontSize="xs"
                      fontWeight="500"
                      onClick={openForgot}
                    >
                      Mot de passe oublié ?
                    </Button>
                  )}
                </Flex>
                <InputGroup>
                  <InputLeftElement pointerEvents="none">
                    <Lock size={14} color="gray" />
                  </InputLeftElement>
                  <Input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    rounded="sm"
                    fontSize="sm"
                    bg="white"
                    border="1px"
                    borderColor="gray.200"
                    _focus={{ bg: 'white', borderColor: 'blue.500' }}
                    minLength={8}
                  />
                  <InputRightElement>
                    <IconButton
                      aria-label="Afficher/masquer"
                      icon={showPass ? <EyeOff size={13} /> : <Eye size={13} />}
                      variant="ghost"
                      size="sm"
                      color="gray.400"
                      onClick={() => setShowPass(!showPass)}
                    />
                  </InputRightElement>
                </InputGroup>
              </FormControl>

              <Button
                type="submit"
                colorScheme="blue"
                w="full"
                size="md"
                rounded="md"
                isLoading={loading}
                loadingText={mode === 'signup' ? 'Envoi en cours...' : 'Connexion...'}
                fontWeight="600"
                mt={1}
                rightIcon={<ArrowRight size={14} />}
                bg="blue.800"
                _hover={{ bg: 'blue.700' }}
                _active={{ bg: 'blue.900' }}
              >
                {mode === 'signin' ? 'Accéder à mon espace' : 'Soumettre ma demande'}
              </Button>
            </VStack>
          </form>
            </>
          )}

          {/* Security indicators */}
          <HStack justify="center" spacing={5} mt={5} flexWrap="wrap">
            {[
              { Icon: Shield, label: 'Connexion sécurisée SSL' },
              { Icon: CheckCircle, label: 'Données chiffrées' },
              { Icon: Lock, label: 'Conforme RGPD' },
            ].map(({ Icon, label }) => (
              <HStack key={label} spacing={1.5}>
                <Icon size={11} color="var(--chakra-colors-gray-400)" />
                <Text fontSize="11px" color="gray.400">{label}</Text>
              </HStack>
            ))}
          </HStack>

          <Divider my={5} borderColor="gray.100" />
          <Text fontSize="11px" color="gray.400" textAlign="center" lineHeight={1.7}>
            En accédant à la plateforme, vous acceptez les{' '}
            <Text as="span" color="blue.600" cursor="pointer" _hover={{ textDecoration: 'underline' }}>
              Conditions Générales d'Utilisation
            </Text>
            {' '}et la{' '}
            <Text as="span" color="blue.600" cursor="pointer" _hover={{ textDecoration: 'underline' }}>
              Politique de confidentialité
            </Text>
            {' '}de Stock212.
          </Text>
        </Box>
      </Flex>

      <ForgotPasswordModal isOpen={isForgotOpen} onClose={closeForgot} />
    </Flex>
  );
}