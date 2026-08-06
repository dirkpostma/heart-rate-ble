import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../app/navigation';
import { useDevModeTap } from '../store/useDevModeTap';
import { AboutLayoutPrototype } from './about-prototype/AboutLayoutPrototype';

type Props = NativeStackScreenProps<RootStackParamList, 'About'>;

// PROTOTYPE HOST for wayfinder ticket #180 (About layout with Settings).
// Production About is replaced on branch prototype/about-settings-layout-180
// only — do not merge this host to main.
export function AboutScreen({ navigation }: Props) {
  const onCreditTap = useDevModeTap();
  return (
    <AboutLayoutPrototype
      onConnectHelp={() => navigation.navigate('ConnectHelp')}
      onCreditTap={() => onCreditTap()}
    />
  );
}
