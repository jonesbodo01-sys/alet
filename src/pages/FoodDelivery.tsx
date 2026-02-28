import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, PanInfo, AnimatePresence } from 'framer-motion';
import { X, Plus, Calendar, User, Briefcase, ChevronDown } from 'lucide-react';
import { useGlobalCart } from '../contexts/GlobalCartContext';
import { DeliveryCard } from '../components/DeliveryCard';

interface DeliveryMode {
  id: 'motorbike' | 'car' | 'bicycle';
  label: string;
  time: string;
  description: string;
  deliveryFee: number;
  icon: string;
}

type FilterTab = 'standard' | 'faster' | 'cheaper';

const PROMO_TEXT = '30% promo applied';
const PROMO_ACTIVE = true;

const PANEL_MIN_HEIGHT = 30;
const PANEL_MAX_HEIGHT = 85;
const SNAP_THRESHOLD = 65;

export function FoodDelivery() {
  const navigate = useNavigate();
  const { cart } = useGlobalCart();

  // Load data from localStorage (from FoodiesRoute)
  const [routeData, setRouteData] = useState<any>(() => {
    const stored = localStorage.getItem('FOODIES_ROUTE_DATA');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (error) {
        console.error('Error loading route data:', error);
        return null;
      }
    }
    return null;
  });

  const [selectedFilter, setSelectedFilter] = useState<FilterTab>('standard');
  const [selectedModeId, setSelectedModeId] = useState<'motorbike' | 'car' | 'bicycle'>('car');
  const [panelHeight, setPanelHeight] = useState(PANEL_MIN_HEIGHT);
  const [profileToggle, setProfileToggle] = useState<'personal' | 'business'>('personal');
  const panelRef = useRef<HTMLDivElement>(null);

  // Use route data from localStorage
  const deliveryLocation = routeData?.deliveryLocation || '';
  const stops = routeData?.stops || [];

  const deliveryModes: DeliveryMode[] = [
    {
      id: 'motorbike',
      label: 'Motorbike',
      time: '2 min',
      description: 'Fast delivery',
      deliveryFee: 40,
      icon: '🏍️'
    },
    {
      id: 'car',
      label: 'Car',
      time: '20 min',
      description: 'Standard delivery',
      deliveryFee: 60,
      icon: '🚗'
    },
    {
      id: 'bicycle',
      label: 'Bicycle',
      time: '20 min',
      description: 'Eco-friendly delivery',
      deliveryFee: 25,
      icon: '🚴'
    }
  ];

  // CART IS THE SINGLE SOURCE OF TRUTH
  // Total item count from cart (includes all items - current location + all stops)
  const totalItemCount = useMemo(() => cart.length, [cart.length]);

  // Food subtotal from cart (constant across all delivery modes)
  const foodSubtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.price, 0);
  }, [cart]);

  // Delivery fee changes based on selected mode
  const selectedMode = deliveryModes.find(m => m.id === selectedModeId);
  const deliveryFee = selectedMode?.deliveryFee || 0;

  // Total = constant subtotal + variable delivery fee
  const total = foodSubtotal + deliveryFee;

  const isExpanded = panelHeight > SNAP_THRESHOLD;

  useEffect(() => {
    if (!routeData || cart.length === 0) {
      console.log('No route data or empty cart, redirecting to shop');
      navigate('/shop', { replace: true });
    }
  }, [routeData, cart.length, navigate]);

  useEffect(() => {
    if (selectedFilter === 'standard') {
      setSelectedModeId('car');
    } else if (selectedFilter === 'faster') {
      setSelectedModeId('motorbike');
    } else if (selectedFilter === 'cheaper') {
      setSelectedModeId('bicycle');
    }
  }, [selectedFilter]);

  const getSortedModes = (): DeliveryMode[] => {
    let sorted = [...deliveryModes];

    if (selectedFilter === 'faster') {
      sorted.sort((a, b) => parseInt(a.time) - parseInt(b.time));
    } else if (selectedFilter === 'cheaper') {
      sorted.sort((a, b) => a.deliveryFee - b.deliveryFee);
    }

    return sorted;
  };

  const sortedModes = getSortedModes();

  const handleDrag = (event: any, info: PanInfo) => {
    const windowHeight = window.innerHeight;
    const dragDelta = -info.offset.y;
    const dragPercent = (dragDelta / windowHeight) * 100;
    const newHeight = Math.max(PANEL_MIN_HEIGHT, Math.min(PANEL_MAX_HEIGHT, PANEL_MIN_HEIGHT + dragPercent));
    setPanelHeight(newHeight);
  };

  const handleDragEnd = (event: any, info: PanInfo) => {
    const velocity = -info.velocity.y;

    if (Math.abs(velocity) > 500) {
      if (velocity > 0) {
        setPanelHeight(PANEL_MAX_HEIGHT);
      } else {
        setPanelHeight(PANEL_MIN_HEIGHT);
      }
    } else {
      if (panelHeight > SNAP_THRESHOLD) {
        setPanelHeight(PANEL_MAX_HEIGHT);
      } else {
        setPanelHeight(PANEL_MIN_HEIGHT);
      }
    }
  };

  const handleClose = () => {
    // Use navigate(-1) to go back to previous page cleanly
    navigate(-1);
  };

  const handleAddStop = () => {
    // Update localStorage before navigating back
    const updatedData = {
      ...routeData,
      timestamp: Date.now()
    };
    localStorage.setItem('FOODIES_ROUTE_DATA', JSON.stringify(updatedData));

    // Use navigate(-1) to avoid route stacking
    navigate(-1);
  };

  const handleAddressClick = () => {
    // Use navigate(-1) to go back cleanly
    navigate(-1);
  };

  const handleSelectMode = () => {
    if (!routeData) {
      navigate('/shop');
      return;
    }

    const selectedDeliveryMode = deliveryModes.find(m => m.id === selectedModeId);
    if (!selectedDeliveryMode) return;

    navigate('/confirm-order', {
      state: {
        orderType: 'food',
        orderData: {
          deliveryMode: selectedDeliveryMode,
          pickupAddress: routeData.pickupLocation || 'Current Location',
          destinationAddress: routeData.deliveryLocation || 'Destination',
          stops: stops || [],
          items: cart,
          foodSubtotal: foodSubtotal,
          deliveryFee: deliveryFee,
          totalPrice: total
        }
      }
    });
  };

  const handleCashClick = () => {
    console.log('Cash payment clicked');
  };

  const handleScheduleClick = () => {
    console.log('Schedule clicked');
  };

  const getAddressDisplay = () => {
    const mainAddress = deliveryLocation || 'Current Location';
    const stopsText = stops.length > 0 ? ` +${stops.length} stop${stops.length > 1 ? 's' : ''}` : '';
    return `${mainAddress}${stopsText}`;
  };

  return (
    <div className="fixed inset-0 bg-gray-100 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-100 via-blue-50 to-green-100">
        <div className="absolute inset-0 opacity-40">
          <svg className="w-full h-full">
            <defs>
              <pattern id="map-grid" width="60" height="60" patternUnits="userSpaceOnUse">
                <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#cbd5e1" strokeWidth="1"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#map-grid)" />

            <path
              d="M 200 400 Q 250 300 300 200"
              stroke="#4f46e5"
              strokeWidth="4"
              fill="none"
              strokeLinecap="round"
            />
          </svg>
        </div>

        <div className="absolute top-1/3 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
          <div className="w-8 h-8 bg-green-500 rounded-full border-4 border-white shadow-lg" />
        </div>
        <div className="absolute top-2/3 right-1/3">
          <div className="w-6 h-6 bg-blue-500 rounded-full border-4 border-white shadow-lg" />
        </div>

        <motion.div
          className="absolute top-32 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg text-sm font-semibold"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.3, type: 'spring' }}
        >
          Arrive by 4:55 PM
        </motion.div>
      </div>

      <motion.div
        className="absolute top-4 left-4 right-4 z-30"
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        <div className="bg-white rounded-2xl shadow-lg px-4 py-3 flex items-center gap-3">
          <button
            onClick={handleClose}
            className="flex-shrink-0 w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded-full transition-colors"
          >
            <X size={20} className="text-gray-700" />
          </button>

          <button
            onClick={handleAddressClick}
            className="flex-1 text-left min-w-0"
          >
            <div className="overflow-x-auto scrollbar-hide" style={{ WebkitOverflowScrolling: 'touch' }}>
              <div className="flex items-center gap-2 whitespace-nowrap">
                <span className="text-sm font-medium text-gray-900">
                  {getAddressDisplay()}
                </span>
                <span className="text-gray-400">→</span>
                <span className="text-sm font-medium text-gray-700">
                  Delivery ({totalItemCount} item{totalItemCount !== 1 ? 's' : ''})
                </span>
              </div>
            </div>
          </button>

          <button
            onClick={handleAddStop}
            className="flex-shrink-0 w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded-full transition-colors"
          >
            <Plus size={20} className="text-gray-700" />
          </button>
        </div>
      </motion.div>

      <motion.div
        ref={panelRef}
        className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl z-20 flex flex-col"
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        animate={{
          height: `${panelHeight}vh`
        }}
        transition={{
          type: 'spring',
          damping: 30,
          stiffness: 300
        }}
        style={{
          touchAction: 'none'
        }}
      >
        {PROMO_ACTIVE && (
          <motion.div
            className="bg-blue-600 text-white w-full px-4 py-3 flex items-center justify-center gap-2 rounded-t-3xl flex-shrink-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            <span className="text-white">✓</span>
            <span className="font-medium text-sm">{PROMO_TEXT}</span>
            <ChevronDown size={16} />
          </motion.div>
        )}

        <div className="w-full pt-3 pb-2 flex justify-center cursor-grab active:cursor-grabbing flex-shrink-0">
          <div className="w-12 h-1 bg-gray-300 rounded-full" />
        </div>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              className="px-4 flex-shrink-0 overflow-hidden"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{
                type: 'spring',
                damping: 25,
                stiffness: 300,
                opacity: { duration: 0.2 }
              }}
            >
              <div className="flex gap-3 mb-4">
                <motion.button
                  onClick={() => setSelectedFilter('standard')}
                  className={`px-4 py-2 rounded-full font-medium text-sm transition-all whitespace-nowrap ${
                    selectedFilter === 'standard'
                      ? 'bg-white border-2 border-green-600 text-gray-900'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  transition={{ delay: 0.05, type: 'spring', damping: 20, stiffness: 300 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Standard
                </motion.button>
                <motion.button
                  onClick={() => setSelectedFilter('faster')}
                  className={`px-4 py-2 rounded-full font-medium text-sm transition-all flex items-center gap-1 whitespace-nowrap ${
                    selectedFilter === 'faster'
                      ? 'bg-white border-2 border-green-600 text-gray-900'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  transition={{ delay: 0.1, type: 'spring', damping: 20, stiffness: 300 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <span>⚡</span>
                  Faster
                </motion.button>
                <motion.button
                  onClick={() => setSelectedFilter('cheaper')}
                  className={`px-4 py-2 rounded-full font-medium text-sm transition-all flex items-center gap-1 whitespace-nowrap ${
                    selectedFilter === 'cheaper'
                      ? 'bg-white border-2 border-green-600 text-gray-900'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  transition={{ delay: 0.15, type: 'spring', damping: 20, stiffness: 300 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <span>💰</span>
                  Cheaper
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex-1 overflow-y-auto px-4" style={{ WebkitOverflowScrolling: 'touch' }}>
          <div className="space-y-3 mb-6">
            {sortedModes.map((mode, index) => (
              <DeliveryCard
                key={mode.id}
                mode={mode}
                subtotal={foodSubtotal}
                totalItemCount={totalItemCount}
                isSelected={selectedModeId === mode.id}
                onSelect={() => setSelectedModeId(mode.id)}
                index={index}
              />
            ))}
          </div>

          <motion.div
            className="bg-white border-t border-gray-200 pt-4 space-y-3 mb-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Food subtotal</span>
              <span className="font-medium text-gray-900">R {foodSubtotal}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Delivery fee</span>
              <span className="font-medium text-gray-900">R {deliveryFee}</span>
            </div>
            <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-200">
              <span className="text-gray-900">Total</span>
              <span className="text-gray-900">R {foodSubtotal + deliveryFee}</span>
            </div>
          </motion.div>
        </div>

        <div className="flex-shrink-0 bg-white border-t border-gray-200 px-4 py-3">
          <div className="flex items-center gap-2 mb-3">
            <div className="relative bg-gray-100 rounded-full p-1 flex items-center flex-shrink-0">
              <motion.div
                className="absolute top-1 bottom-1 left-1 bg-white rounded-full shadow-md"
                animate={{
                  width: 40,
                  x: profileToggle === 'personal' ? 0 : 40
                }}
                transition={{ type: 'spring', damping: 20, stiffness: 300 }}
              />
              <button
                onClick={() => setProfileToggle('personal')}
                className="relative z-10 w-10 h-10 flex items-center justify-center"
              >
                <User size={18} className={profileToggle === 'personal' ? 'text-gray-900' : 'text-gray-400'} />
              </button>
              <button
                onClick={() => setProfileToggle('business')}
                className="relative z-10 w-10 h-10 flex items-center justify-center"
              >
                <Briefcase size={18} className={profileToggle === 'business' ? 'text-gray-900' : 'text-gray-400'} />
              </button>
            </div>

            <motion.button
              onClick={handleCashClick}
              className="py-2 px-3 bg-white border border-gray-300 rounded-lg font-medium text-gray-900 hover:bg-gray-50 transition-colors flex items-center justify-center gap-1 flex-shrink-0 text-sm"
              whileTap={{ scale: 0.95 }}
            >
              Cash
              <ChevronDown size={14} />
            </motion.button>

            <div className="flex-1" />

            <motion.button
              onClick={handleScheduleClick}
              className="w-12 h-12 bg-green-600 text-white rounded-2xl flex items-center justify-center hover:bg-green-700 transition-colors shadow-lg flex-shrink-0"
              whileTap={{ scale: 0.95 }}
            >
              <Calendar size={20} />
            </motion.button>
          </div>

          <motion.button
            onClick={handleSelectMode}
            className="w-full bg-green-600 text-white py-3 rounded-2xl font-bold text-base hover:bg-green-700 transition-colors shadow-lg"
            whileTap={{ scale: 0.98 }}
          >
            Select {selectedMode?.label}
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
