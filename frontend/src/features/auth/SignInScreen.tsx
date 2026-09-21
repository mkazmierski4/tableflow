import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';

import { AppText, Button, Icon, Input, Screen, SegmentedControl } from '@/components/ui';
import { ApiError, type FieldErrors } from '@/lib/api';

import { useAuth } from './AuthProvider';

type Mode = 'signIn' | 'signUp';

const MODES = [
  { value: 'signIn', label: 'Sign in' },
  { value: 'signUp', label: 'Create account' },
] as const;

const EMAIL = /^\S+@\S+\.\S+$/;
export const MIN_PASSWORD_LENGTH = 8;

export function validate(
  mode: Mode,
  values: { email: string; password: string; fullName: string },
): FieldErrors {
  const errors: FieldErrors = {};
  if (!EMAIL.test(values.email.trim())) errors.email = 'Enter a valid e-mail address.';
  if (
    mode === 'signIn' ? values.password.length === 0 : values.password.length < MIN_PASSWORD_LENGTH
  ) {
    errors.password =
      mode === 'signIn'
        ? 'Enter your password.'
        : `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (mode === 'signUp' && values.fullName.trim() === '') errors.full_name = 'Enter your name.';
  return errors;
}

export function SignInScreen() {
  const router = useRouter();
  const { signIn, signUp } = useAuth();

  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const switchMode = (next: Mode) => {
    setMode(next);
    setErrors({});
    setFormError(null);
  };

  const submit = async () => {
    const found = validate(mode, { email, password, fullName });
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);
    try {
      if (mode === 'signIn') await signIn(email, password);
      else await signUp({ email, password, full_name: fullName.trim() });
      router.replace('/');
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors(error.fieldErrors);
        // Field errors are shown on the fields; anything else goes in the banner.
        if (Object.keys(error.fieldErrors).length === 0) setFormError(error.message);
      } else {
        setFormError('Something went wrong. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="gap-6"
      >
        <View className="flex-row items-center gap-2.5 pt-4">
          <View className="h-9 w-9 items-center justify-center rounded-[11px] bg-accent">
            <Icon name="grid" size={20} color="on-accent" strokeWidth={2} />
          </View>
          <AppText variant="title">TableFlow</AppText>
        </View>

        <View className="gap-2">
          <AppText variant="display" accessibilityRole="header">
            Book a table in seconds.
          </AppText>
          <AppText variant="body">
            See which tables are free for your party and time, then reserve with one tap.
          </AppText>
        </View>

        <SegmentedControl
          accessibilityLabel="Sign in or create an account"
          options={MODES}
          value={mode}
          onChange={switchMode}
        />

        <View className="gap-4">
          {mode === 'signUp' ? (
            <Input
              label="Full name"
              value={fullName}
              onChangeText={setFullName}
              error={errors.full_name}
              autoComplete="name"
              textContentType="name"
              returnKeyType="next"
            />
          ) : null}
          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            error={errors.email}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="next"
          />
          <Input
            label="Password"
            value={password}
            onChangeText={setPassword}
            error={errors.password}
            placeholder={
              mode === 'signUp' ? `At least ${MIN_PASSWORD_LENGTH} characters` : undefined
            }
            secureTextEntry
            autoCapitalize="none"
            autoComplete={mode === 'signUp' ? 'new-password' : 'current-password'}
            textContentType={mode === 'signUp' ? 'newPassword' : 'password'}
            returnKeyType="go"
            onSubmitEditing={() => void submit()}
          />
        </View>

        {formError ? (
          <AppText testID="form-error" variant="bodySmall" tone="danger" accessibilityRole="alert">
            {formError}
          </AppText>
        ) : null}

        <Button
          label={mode === 'signIn' ? 'Sign in' : 'Create account'}
          onPress={() => void submit()}
          loading={submitting}
        />
        <Button
          label="Browse restaurants without an account"
          variant="ghost"
          onPress={() => router.replace('/')}
        />
      </KeyboardAvoidingView>
    </Screen>
  );
}
