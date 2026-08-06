import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Switch,
} from 'react-native';
import { AppTextField } from '../inputs/AppTextField';
import { PrimaryButton } from '../buttons/PrimaryButton';
import { SlideUpModal } from '../common/SlideUpModal';
import { ExpenseService } from '../../services/expenseService';
import { X, Utensils, Home, Compass, ShoppingBag, Car, Receipt } from 'lucide-react-native';

interface AddExpenseModalProps {
  visible: boolean;
  onClose: () => void;
}

const CATEGORIES = [
  { name: 'Food', icon: Utensils, bg: 'bg-lightOrangeBg', color: '#F0A93E' },
  { name: 'Stay', icon: Home, bg: 'bg-lightGreenBg', color: '#3A8E71' },
  { name: 'Activities', icon: Compass, bg: 'bg-lightBlueBg', color: '#3B7A9E' },
  { name: 'Groceries', icon: ShoppingBag, bg: 'bg-lightRedBg', color: '#E2604A' },
  { name: 'Transport', icon: Car, bg: 'bg-lightOrangeBg', color: '#B8791E' },
  { name: 'General', icon: Receipt, bg: 'bg-paperDim', color: '#6E738A' },
];

const PAYERS = ['Steven', 'Harry', 'Ahiah', 'Travis', 'Me'];

export const AddExpenseModal: React.FC<AddExpenseModalProps> = ({ visible, onClose }) => {
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [paidBy, setPaidBy] = useState('Me');
  const [category, setCategory] = useState('Food');
  const [isPinaluwal, setIsPinaluwal] = useState(false);
  const [notes, setNotes] = useState('');

  const handleSave = () => {
    if (!title.trim() || !amount.trim()) return;
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) return;

    ExpenseService.getInstance().addExpense({
      title: title.trim(),
      amount: parsedAmount,
      paidBy,
      category,
      isPinaluwal,
      notes: notes.trim() ? notes.trim() : undefined,
    });

    // Reset & close
    setTitle('');
    setAmount('');
    setNotes('');
    setIsPinaluwal(false);
    onClose();
  };

  return (
    <SlideUpModal visible={visible} onClose={onClose} backdropOpacity={0.4} useKeyboardAvoiding>
      <View className="bg-paper rounded-t-3xl max-h-[90%] p-5 border-t border-rule">
        {/* Header */}
        <View className="flex-row justify-between items-center pb-4 mb-2 border-b border-rule">
          <Text className="text-xl font-extrabold text-ink">Add New Expense</Text>
          <TouchableOpacity onPress={onClose} className="p-1">
            <X size={22} color="#1A1D2D" />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Expense Title */}
          <AppTextField
            label="Expense Title"
            placeholder="e.g. Seafood Dinner at Artcafe"
            value={title}
            onChangeText={setTitle}
          />

          {/* Amount */}
          <AppTextField
            label="Amount (₱)"
            placeholder="0.00"
            keyboardType="numeric"
            value={amount}
            onChangeText={setAmount}
          />

          {/* Paid By */}
          <Text className="text-xs font-bold text-ink mb-1.5 uppercase">Paid By</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
            <View className="flex-row space-x-2">
              {PAYERS.map((p) => {
                const isSelected = paidBy === p;
                return (
                  <TouchableOpacity
                    key={p}
                    onPress={() => setPaidBy(p)}
                    className={`px-4 py-2 rounded-full border ${
                      isSelected
                        ? 'bg-sky border-sky'
                        : 'bg-white border-rule'
                    }`}
                  >
                    <Text
                      className={`text-sm font-semibold ${
                        isSelected ? 'text-white' : 'text-ink'
                      }`}
                    >
                      {p}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          {/* Category Selection */}
          <Text className="text-xs font-bold text-ink mb-1.5 uppercase">Category</Text>
          <View className="flex-row flex-wrap gap-2 mb-4">
            {CATEGORIES.map((cat) => {
              const isSelected = category === cat.name;
              const IconComponent = cat.icon;
              return (
                <TouchableOpacity
                  key={cat.name}
                  onPress={() => setCategory(cat.name)}
                  className={`flex-row items-center px-3.5 py-2 rounded-xl border ${
                    isSelected
                      ? 'bg-ink border-ink'
                      : 'bg-white border-rule'
                  }`}
                >
                  <IconComponent
                    size={16}
                    color={isSelected ? '#FFFFFF' : cat.color}
                  />
                  <Text
                    className={`text-xs font-bold ml-1.5 ${
                      isSelected ? 'text-white' : 'text-ink'
                    }`}
                  >
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Pinaluwal Toggle */}
          <View className="flex-row items-center justify-between p-3.5 bg-white rounded-xl border border-rule mb-4">
            <View className="flex-1 pr-3">
              <Text className="text-sm font-bold text-ink">Advance Payment (Pinaluwal)</Text>
              <Text className="text-xs text-inkSoft mt-0.5">
                Paid ahead on behalf of the barkada
              </Text>
            </View>
            <Switch
              value={isPinaluwal}
              onValueChange={setIsPinaluwal}
              trackColor={{ false: '#EAE4D7', true: '#1F4E67' }}
              thumbColor="#FFFFFF"
            />
          </View>

          {/* Notes */}
          <AppTextField
            label="Notes (Optional)"
            placeholder="Add details, receipt reference, etc."
            value={notes}
            onChangeText={setNotes}
          />

          {/* Action */}
          <View className="mt-2 mb-6">
            <PrimaryButton label="Save Expense to Ledger" onPress={handleSave} />
          </View>
        </ScrollView>
      </View>
    </SlideUpModal>
  );
};
