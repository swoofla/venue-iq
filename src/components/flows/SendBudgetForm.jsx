import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { base44 } from '@/api/base44Client';
import { Loader2, CheckCircle, AlertCircle, ArrowLeft } from 'lucide-react';

export default function SendBudgetForm({ totalBudget, budgetData, venueName, onSuccess, onCancel, onEditBudget }) {
  const [step, setStep] = useState(0); // 0: form, 1: confirmation
  const [formData, setFormData] = useState({ name: '', email: '', phone: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError('');
  };

  const [deliveryPreference, setDeliveryPreference] = React.useState('email');

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate
    if (!formData.name.trim()) {
      setError('Please enter your name');
      return;
    }

    if (deliveryPreference === 'email' && !formData.email.trim()) {
      setError('Please enter your email address');
      return;
    }

    if (deliveryPreference === 'text' && !formData.phone.trim()) {
      setError('Please enter your phone number');
      return;
    }

    if (deliveryPreference === 'email') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        setError('Please enter a valid email address');
        return;
      }
    }

    setLoading(true);
    try {
      const response = await base44.functions.invoke('sendBudgetQuote', {
        name: formData.name,
        email: formData.email || null,
        phone: formData.phone || null,
        budgetData,
        venueName,
        totalBudget,
        deliveryPreference
      });

      if (response.data.success) {
        setStep(1);
        onSuccess(formData);
      } else {
        setError('Failed to send budget. Please try again.');
      }
    } catch (err) {
      setError('Error sending budget. Please try again.');
      console.error('Send budget error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Confirmation screen
  if (step === 1) {
    return (
      <div className="text-center space-y-4">
        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle className="w-6 h-6 text-green-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-stone-900">Budget Saved!</h3>
          <p className="text-sm text-stone-600 mt-1">
            Check your {deliveryPreference === 'email' ? 'email' : 'texts'} for your ${totalBudget.toLocaleString()} estimate.
          </p>
        </div>

        <div className="space-y-2 pt-4">
          <Button onClick={() => onSuccess({ ...formData, totalBudget })} className="w-full rounded-full bg-black hover:bg-stone-800">
            Schedule a Tour
          </Button>
          <Button onClick={onCancel} variant="outline" className="w-full rounded-full">
            Back to Chat
          </Button>
          <button
            onClick={() => {
              setStep(0);
              onEditBudget?.();
            }}
            className="w-full py-2 text-stone-600 hover:text-stone-900 text-sm font-medium transition-colors"
          >
            ← Edit Budget
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-stone-50 border border-stone-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-stone-700">
              We'll send a copy of your <span className="font-semibold">${totalBudget.toLocaleString()}</span> estimate to you and our planning team at {venueName}.
            </p>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-stone-700 mb-3">
              How would you like to receive your estimate? *
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setDeliveryPreference('email')}
                disabled={loading}
                className={`flex-1 p-3 rounded-lg border-2 transition-all ${
                  deliveryPreference === 'email'
                    ? 'border-black bg-black text-white'
                    : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300'
                }`}
              >
                📧 Email
              </button>
              <button
                type="button"
                onClick={() => setDeliveryPreference('text')}
                disabled={loading}
                className={`flex-1 p-3 rounded-lg border-2 transition-all ${
                  deliveryPreference === 'text'
                    ? 'border-black bg-black text-white'
                    : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300'
                }`}
              >
                💬 SMS
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">
              First Name *
            </label>
            <Input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Your first name"
              disabled={loading}
              className="w-full"
            />
          </div>

          {deliveryPreference === 'email' && (
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">
                Email Address *
              </label>
              <Input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="your@email.com"
                disabled={loading}
                className="w-full"
              />
            </div>
          )}

          {deliveryPreference === 'text' && (
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">
                Phone Number *
              </label>
              <Input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="(555) 123-4567"
                disabled={loading}
                className="w-full"
              />
            </div>
          )}

      {error && (
        <div className="flex gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <div className="flex gap-2 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={loading}
          className="flex-1 rounded-full"
        >
          Back
        </Button>
        <Button
          type="submit"
          disabled={loading}
          className="flex-1 rounded-full bg-black hover:bg-stone-800"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            'Save & Send Budget'
          )}
        </Button>
      </div>
    </form>
  );
}