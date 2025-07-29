import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import axios from 'axios';

interface PaymentFormProps {
  clientSecret: string;
  onSuccess?: (paymentIntentId: string) => void;
  onError?: (error: string) => void;
}

const PaymentForm: React.FC<PaymentFormProps> = ({ clientSecret, onSuccess, onError }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Confirm payment with Stripe using the pre-created payment intent
      const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(
        clientSecret,
        {
          payment_method: {
            card: elements.getElement(CardElement)!,
          },
        }
      );

      if (stripeError) {
        setError(stripeError.message || 'Payment failed');
        onError?.(stripeError.message || 'Payment failed');
      } else if (paymentIntent?.status === 'succeeded') {
        onSuccess?.(paymentIntent.id);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Payment failed';
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-md mx-auto">
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Card Details
        </label>
        <div className="border border-gray-300 rounded-md p-3">
          <CardElement
            options={{
              style: {
                base: {
                  fontSize: '16px',
                  color: '#424770',
                  '::placeholder': {
                    color: '#aab7c4',
                  },
                },
                invalid: {
                  color: '#9e2146',
                },
              },
            }}
          />
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || isProcessing}
        className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isProcessing ? 'Processing...' : 'Pay'}
      </button>
    </form>
  );
};

interface StripePaymentProps {
  amount: number;
  onSuccess?: (paymentIntentId: string) => void;
  onError?: (error: string) => void;
}

const StripePayment: React.FC<StripePaymentProps> = ({ amount, onSuccess, onError }) => {
  const [stripeConfig, setStripeConfig] = useState<{ publishable_key: string } | null>(null);
  const [paymentIntent, setPaymentIntent] = useState<{ client_secret: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initializePayment = async () => {
      try {
        // Fetch Stripe config from backend
        const configResponse = await axios.get('/api/stripe-config');
        setStripeConfig(configResponse.data);

        // Create payment intent on backend
        const paymentResponse = await axios.post('/api/create-payment-intent', {
          amount: amount * 100, // Convert to cents
          currency: 'usd',
        });

        setPaymentIntent(paymentResponse.data);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to initialize payment';
        setError(errorMessage);
        onError?.(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    initializePayment();
  }, [amount, onError]);

  if (loading) {
    return <div>Loading payment form...</div>;
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto p-3 bg-red-100 border border-red-400 text-red-700 rounded">
        {error}
      </div>
    );
  }

  if (!stripeConfig || !paymentIntent) {
    return <div>Failed to load payment configuration</div>;
  }

  return (
    <Elements stripe={loadStripe(stripeConfig.publishable_key)}>
      <PaymentForm
        clientSecret={paymentIntent.client_secret}
        onSuccess={onSuccess}
        onError={onError}
      />
    </Elements>
  );
};

export default StripePayment;