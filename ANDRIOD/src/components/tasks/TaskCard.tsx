import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { Task } from '@types';
import { formatCoins } from '@utils/validation';
import { Ionicons } from '@expo/vector-icons';

interface TaskCardProps {
    task: Task;
    onPress: () => void;
}

const TaskCard: React.FC<TaskCardProps> = ({ task, onPress }) => {
    return (
        <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
            {task.thumbnail && (
                <Image source={{ uri: task.thumbnail }} style={styles.thumbnail} />
            )}
            <View style={styles.content}>
                <View style={styles.header}>
                    <Text style={styles.title}>{task.title}</Text>
                    {task.isCompleted && (
                        <Ionicons name="checkmark-circle" size={24} color="#34C759" />
                    )}
                </View>
                <Text style={styles.description} numberOfLines={2}>
                    {task.description}
                </Text>
                <View style={styles.footer}>
                    <View style={styles.coinBadge}>
                        <Ionicons name="cash" size={16} color="#FFD700" />
                        <Text style={styles.coinText}>{formatCoins(task.coins)}</Text>
                    </View>
                    {task.isCompleted ? (
                        <Text style={styles.completedText}>Completed</Text>
                    ) : (
                        <Text style={styles.startText}>Start Task →</Text>
                    )}
                </View>
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        marginBottom: 12,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    thumbnail: {
        width: '100%',
        height: 180,
        backgroundColor: '#F2F2F7',
    },
    content: {
        padding: 16,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    title: {
        fontSize: 18,
        fontWeight: '600',
        color: '#000000',
        flex: 1,
    },
    description: {
        fontSize: 14,
        color: '#8E8E93',
        marginBottom: 12,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    coinBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF9E6',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
    },
    coinText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#FF9500',
        marginLeft: 4,
    },
    completedText: {
        fontSize: 14,
        color: '#34C759',
        fontWeight: '600',
    },
    startText: {
        fontSize: 14,
        color: '#007AFF',
        fontWeight: '600',
    },
});

export default TaskCard;

