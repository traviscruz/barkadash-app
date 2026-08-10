import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Expense } from '../../types/expense';
import { AppTextField } from '../inputs/AppTextField';
import { PrimaryButton } from '../buttons/PrimaryButton';
import { SlideUpModal } from '../common/SlideUpModal';
import { ExpenseService } from '../../services/expenseService';
import { useTheme } from '../../context/ThemeContext';
import { X } from 'lucide-react-native';

interface EditExpenseModalProps {
  expense: Expense | null;
  visible: boolean;
  onClose: () => void;
}

export const EditExpenseModal: React.FC<EditExpenseModalProps> = ({
  expense,
  visible,
  onClose,
}) => {
  const { colors } = useTheme();
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (expense) {
      setTitle(expense.title);
      setAmount(expense.amount.toString());
      setNotes(expense.notes || '');
    }
  }, [expense]);

  const handleUpdate = () => {
    if (!expense || !title.trim() || !amount.trim()) return;
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) return;

    ExpenseService.getInstance().editExpense(expense.id, {
      title: title.trim(),
      amount: parsedAmount,
      notes: notes.trim() ? notes.trim() : undefined,
    });

    onClose();
  };

  return (
    <SlideUpModal visible={visible} onClose={onClose} backdropOpacity={0.4} useKeyboardAvoiding>
      <View
        style={{ backgroundColor: colors.paper, borderColor: colors.cardBorder }}
        className="rounded-t-3xl max-h-[80%] p-5 border-t"
      >
        <View style={{ borderColor: colors.cardBorder }} className="flex-row justify-between items-center pb-3 mb-2 border-b">
          <Text style={{ color: colors.ink }} className="text-xl font-extrabold">Edit Expense</Text>
          <TouchableOpacity onPress={onClose} className="p-1">
            <X size={22} color={colors.ink} />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          <AppTextField
            label="Expense Title"
            value={title}
            onChangeText={setTitle}
          />

          <AppTextField
            label="Amount (₱)"
            keyboardType="numeric"
            value={amount}
            onChangeText={setAmount}
          />

          <AppTextField
            label="Notes"
            value={notes}
            onChangeText={setNotes}
          />

          <View className="mt-4 mb-6">
            <PrimaryButton label="Update Expense" onPress={handleUpdate} />
          </View>
        </ScrollView>
      </View>
    </SlideUpModal>
  );
};
