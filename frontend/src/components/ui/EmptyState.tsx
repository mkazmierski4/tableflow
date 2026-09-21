import { View } from 'react-native';

import { AppText } from './AppText';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';

type EmptyStateProps = {
  icon: IconName;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  testID?: string;
};

export function EmptyState({
  icon,
  title,
  message,
  actionLabel,
  onAction,
  testID,
}: EmptyStateProps) {
  return (
    <View testID={testID} className="items-center gap-3 px-6 py-12">
      <View className="h-14 w-14 items-center justify-center rounded-card bg-raised">
        <Icon name={icon} size={24} color="fg2" />
      </View>
      <AppText variant="heading" className="text-center">
        {title}
      </AppText>
      <AppText variant="body" className="text-center">
        {message}
      </AppText>
      {actionLabel && onAction ? (
        <View className="mt-2 self-stretch">
          <Button label={actionLabel} variant="secondary" onPress={onAction} />
        </View>
      ) : null}
    </View>
  );
}
