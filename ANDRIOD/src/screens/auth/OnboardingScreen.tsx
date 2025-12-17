import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { onboardingStorage } from '@utils/storage';
import { ROUTES } from '@constants';
import Button from '@components/common/Button';

const OnboardingScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [currentPage, setCurrentPage] = useState(0);

  const onboardingData = [
    {
      title: 'Earn Rewards',
      description: 'Complete simple tasks and earn coins',
      icon: 'cash' as keyof typeof Ionicons.glyphMap,
      color: '#007AFF',
    },
    {
      title: 'Watch Videos',
      description: 'Watch videos and get rewarded',
      icon: 'play-circle' as keyof typeof Ionicons.glyphMap,
      color: '#34C759',
    },
    {
      title: 'Follow & Like',
      description: 'Follow Instagram accounts and like posts',
      icon: 'heart' as keyof typeof Ionicons.glyphMap,
      color: '#FF3B30',
    },
    {
      title: 'Withdraw Money',
      description: 'Convert your coins to real money',
      icon: 'wallet' as keyof typeof Ionicons.glyphMap,
      color: '#FF9500',
    },
  ];

  const handleNext = async () => {
    if (currentPage < onboardingData.length - 1) {
      setCurrentPage(currentPage + 1);
    } else {
      await onboardingStorage.setComplete();
      navigation.replace(ROUTES.LOGIN);
    }
  };

  const handleSkip = async () => {
    await onboardingStorage.setComplete();
    navigation.replace(ROUTES.LOGIN);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        ref={(ref) => {
          if (ref) {
            ref.scrollTo({ x: currentPage * 400, animated: true });
          }
        }}
      >
        {onboardingData.map((item, index) => (
          <View key={index} style={styles.page}>
            <View style={[styles.iconContainer, { backgroundColor: `${item.color}20` }]}>
              <Ionicons name={item.icon} size={80} color={item.color} />
            </View>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.description}>{item.description}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {onboardingData.map((_, index) => (
            <View
              key={index}
              style={[styles.dot, index === currentPage && styles.activeDot]}
            />
          ))}
        </View>
        <View style={styles.buttons}>
          {currentPage < onboardingData.length - 1 && (
            <Button
              title="Skip"
              onPress={handleSkip}
              variant="outline"
              style={styles.skipButton}
            />
          )}
          <Button
            title={currentPage === onboardingData.length - 1 ? 'Get Started' : 'Next'}
            onPress={handleNext}
            style={styles.nextButton}
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  page: {
    width: 400,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  iconContainer: {
    width: 200,
    height: 200,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 16,
    marginTop: 20,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  footer: {
    padding: 20,
    paddingBottom: 40,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 24,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E5E5EA',
    marginHorizontal: 4,
  },
  activeDot: {
    backgroundColor: '#007AFF',
    width: 24,
  },
  buttons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  skipButton: {
    flex: 1,
    marginRight: 12,
  },
  nextButton: {
    flex: 1,
  },
});

export default OnboardingScreen;

