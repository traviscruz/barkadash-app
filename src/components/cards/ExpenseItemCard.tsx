import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Expense } from '../../types/expense';
import { AppCard } from './AppCard';
import { formatCurrency } from '../../utils/formatters';
import { Receipt, Bike, Home, Compass, ShoppingBag, Utensils, Car } from 'lucide-react-native';

interface ExpenseItemCardProps {
  expense: Expense;
  onPress?: () => void;
}

export const ExpenseItemCard: React.FC<ExpenseItemCardProps> = ({ expense, onPress }) => {
  const renderIcon = () => {
    switch (expense.categoryIconName) {
      case 'bike':
        return <Bike size={18} color={expense.iconColor} />;
      case 'home':
        return <Home size={18} color={expense.iconColor} />;
      case 'compass':
      case 'sail':
        return <Compass size={18} color={expense.iconColor} />;
      case 'shopping-bag':
        return <ShoppingBag size={18} color={expense.iconColor} />;
      case 'utensils':
        return <Utensils size={18} color={expense.iconColor} />;
      case 'car':
        return <Car size={18} color={expense.iconColor} />;
      default:
        return <Receipt size={18} color={expense.iconColor} />;
    }
  };

  return (
    <TouchableOpacity activeOpacity={0.8} onPress={onPress}>
      <AppCard className="mb-3 p-3 flex-row items-center justify-between border-rule">
        <View className="flex-row items-center flex-1 pr-2">
          <View
            className="w-11 h-11 rounded-2xl items-center justify-center mr-3"
            style={{ backgroundColor: expense.categoryBg }}
          >
            {renderIcon()}
          </View>
          <View className="flex-1">
            <View className="flex-row items-center">
              <Text className="text-base font-bold text-ink flex-1" numberOfLines={1}>
                {expense.title}
              </Text>
              {expense.isPinaluwal && (
                <View className="bg-lightRedBg px-2 py-0.5 rounded-md ml-1">
                  <Text className="text-redAccent text-[10px] font-bold">PINALUWAL</Text>
                </View>
              )}
            </View>
            <Text className="text-xs text-inkSoft font-medium mt-0.5" numberOfLines={1}>
              {expense.splitDetails}
            </Text>
          </View>
        </View>

        <View className="items-end">
          <Text className="text-base font-bold text-ink">{formatCurrency(expense.amount)}</Text>
          <Text className="text-[11px] text-inkSoft font-normal">{expense.date}</Text>
        </View>
      </AppCard>
    </TouchableOpacity>
  );
};
