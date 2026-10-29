import { Share } from 'react-native';
import { formatCode } from './store';

export function shareGroup(name: string, code: string) {
  Share.share({
    message: `Tritt „${name}“ im Strafenkatalog bei – Gruppencode: ${formatCode(code)}`,
  });
}
