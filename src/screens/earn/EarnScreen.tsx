import React, { useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAppDispatch, useAppSelector } from '@store/hooks';
import { fetchTasks } from '@store/slices/taskSlice';
import { ROUTES } from '@constants';
import TaskCard from '@components/tasks/TaskCard';
import LoadingSpinner from '@components/common/LoadingSpinner';

const EarnScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const dispatch = useAppDispatch();
  const { tasks, isLoading } = useAppSelector((state) => state.tasks);

  useEffect(() => {
    dispatch(fetchTasks());
  }, [dispatch]);

  const handleRefresh = () => {
    dispatch(fetchTasks());
  };

  const handleTaskPress = (taskId: string) => {
    navigation.navigate(ROUTES.TASK_DETAILS, { taskId });
  };

  if (isLoading && tasks.length === 0) {
    return <LoadingSpinner fullScreen />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Available Tasks</Text>
        <Text style={styles.subtitle}>Complete tasks to earn coins</Text>
      </View>

      <FlatList
        data={tasks}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TaskCard task={item} onPress={() => handleTaskPress(item.id)} />
        )}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={handleRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No tasks available</Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  header: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#8E8E93',
  },
  listContent: {
    padding: 16,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#8E8E93',
  },
});

export default EarnScreen;

