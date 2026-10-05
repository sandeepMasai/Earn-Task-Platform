import React, { useState, useEffect } from 'react';
import {
  Image,
  ImageProps,
  ImageStyle,
  StyleProp,
  View,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useAppSelector } from '@store/hooks';
import { getAuthenticatedMediaSource, useMediaUrl } from '@utils/mediaUrl';
import { Ionicons } from '@expo/vector-icons';

export interface AuthenticatedImageProps extends Omit<ImageProps, 'source'> {
  source: string | { uri?: string; headers?: Record<string, string> } | number | null | undefined;
  style?: StyleProp<ImageStyle>;
  fallbackIcon?: keyof typeof Ionicons.glyphMap;
  fallbackIconSize?: number;
  fallbackIconColor?: string;
  showLoadingIndicator?: boolean;
}

export const AuthenticatedImage: React.FC<AuthenticatedImageProps> = ({
  source,
  style,
  fallbackIcon,
  fallbackIconSize = 24,
  fallbackIconColor = '#8E8E93',
  showLoadingIndicator = false,
  onError,
  ...rest
}) => {
  const token = useAppSelector((state) => state.auth.token);
  const [hasError, setHasError] = useState(false);
  const [loading, setLoading] = useState(false);

  // If source is a local require(number), render directly
  if (typeof source === 'number') {
    return <Image source={source} style={style} {...rest} />;
  }

  const rawInput = typeof source === 'object' && source?.uri ? source.uri : (typeof source === 'string' ? source : null);
  const { url: signedUrl, isLoading: isResolvingUrl } = useMediaUrl(rawInput);
  const effectiveUri = signedUrl || rawInput;
  const authSource = getAuthenticatedMediaSource(effectiveUri, token);

  useEffect(() => {
    setHasError(false);
  }, [authSource?.uri, token]);

  if (!authSource?.uri || hasError) {
    if (fallbackIcon) {
      return (
        <View style={[styles.fallbackContainer, style]}>
          <Ionicons name={fallbackIcon} size={fallbackIconSize} color={fallbackIconColor} />
        </View>
      );
    }
    return <View style={[styles.fallbackContainer, style]} />;
  }

  return (
    <View style={style}>
      <Image
        source={authSource}
        style={[StyleSheet.absoluteFill, style]}
        onLoadStart={() => showLoadingIndicator && setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        onError={(e) => {
          setHasError(true);
          setLoading(false);
          onError?.(e);
        }}
        {...rest}
      />
      {loading && showLoadingIndicator && (
        <View style={[StyleSheet.absoluteFill, styles.loadingContainer]}>
          <ActivityIndicator size="small" color="#007AFF" />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  fallbackContainer: {
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
});

export default AuthenticatedImage;
