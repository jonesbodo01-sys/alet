import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, MapPin, Edit, Phone, Share, CreditCard, X, MessageCircle } from 'lucide-react';
import { DraggablePanel } from '../components/DraggablePanel';
import { ScrollableSection } from '../components/ScrollableSection';
import { MapBackground } from '../components/MapBackground';
import { MessagePanel } from '../components/MessagePanel';
import { RatingModal } from '../components/RatingModal';
import { calculatePriceWithStops, getCarTypePrice } from '../utils/priceCalculation';
import { firebaseService } from '../services/firebaseService';
import { useNavigate, useLocation } from 'react-router-dom';
import { useUserProfile } from '../hooks/useUserProfile';
import { useFirebaseRide } from '../hooks/useFirebaseRide';
import { useMessageContext } from '../contexts/MessageContext';
import { database } from '../config/firebase';
import { ref, onValue, off } from 'firebase/database';
import { listenToOrder, listenToDriverLocation, calculateETA } from '../services/trackingService';

interface DriverComingProps {
  destination: string;
  pickup: string;
  stops: string[];
  carType: string;
  price: number;
  currentRideId: string | null;
  onBack: () => void;
}

interface DriverInfo {
  id: string;
  name: string;
  rating: number;
  plateNumber: string;
  carModel: string;
  eta: string;
  photo: string;
  location: {
    latitude: number;
    longitude: number;
  };
}

export const DriverComing: React.FC<DriverComingProps> = ({
  destination,
  pickup,
  stops,
  carType,
  price,
  currentRideId,
  onBack
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useUserProfile();
  const { currentRide } = useFirebaseRide(currentRideId);
  const { unreadMessageCount, markMessagesAsRead } = useMessageContext();

  const { orderType = 'ride', requestId, orderData = {} } = location.state || {};
  const isFood = orderType === 'food';
  const orderId = requestId || currentRideId;

  const [driverInfo, setDriverInfo] = useState<DriverInfo | null>(null);
  const [rideStatus, setRideStatus] = useState<string>('accepted');
  const [statusText, setStatusText] = useState('Finding driver...');
  const [showArrivalAlert, setShowArrivalAlert] = useState(false);
  const [hasShownArrivalAlert, setHasShownArrivalAlert] = useState(false);
  const [isMessagePanelOpen, setIsMessagePanelOpen] = useState(false);
  const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);
  const [showCancelConfirmation, setShowCancelConfirmation] = useState(false);
  const [foodOrderDetails, setFoodOrderDetails] = useState<any>(null);
  const stopLocationListenerRef = useRef<(() => void) | null>(null);

  const finalDestination = isFood ? orderData.destinationAddress : destination;
  const finalPickup = isFood ? orderData.pickupAddress : pickup;
  const finalStops = isFood ? (orderData.stops || []) : stops;
  const finalCarType = isFood ? orderData.deliveryMode?.label : carType;
  const finalPrice = isFood ? orderData.totalPrice : price;

  const priceCalculation = !isFood ? calculatePriceWithStops(pickup, destination, stops) : null;
  const displayPrice = isFood ? finalPrice : (priceCalculation ? getCarTypePrice(priceCalculation.totalPrice, carType) : finalPrice);

  // Fetch driver info
  useEffect(() => {
    const fetchDriverInfo = async () => {
      if (currentRide?.driverId) {
        try {
          const fetchedDriver = await firebaseService.getDriverInfo(currentRide.driverId);
          if (fetchedDriver) {
            setDriverInfo(fetchedDriver);
            return;
          }
        } catch (error) {
          console.error('Error fetching driver info:', error);
        }
      }

      const fallbackDriverInfo: DriverInfo = {
        id: 'driver123',
        name: 'Allen',
        rating: 4.8,
        plateNumber: 'KW14CKGP',
        carModel: 'Silver • Honda Amaze',
        eta: '',
        photo: '👨🏽‍💼',
        location: { latitude: -26.2041, longitude: 28.0473 }
      };
      setDriverInfo(fallbackDriverInfo);
    };
    fetchDriverInfo();
  }, [currentRide]);

  // Live order tracking with GPS-based ETA
  useEffect(() => {
    if (!orderId) return;

    const collectionName = isFood ? 'foodOrders' : 'rides';

    const unsubscribeOrder = listenToOrder(orderId, collectionName, (order) => {
      if (!order) return;

      const newStatus = order.status;
      setRideStatus(newStatus);

      if (isFood) {
        setFoodOrderDetails(order);
        if (order.driverId && !driverInfo) {
          firebaseService.getDriverInfo(order.driverId).then((driver) => {
            if (driver) setDriverInfo(driver);
          });
        }
      }

      if (newStatus === 'arrived' && !hasShownArrivalAlert) {
        setShowArrivalAlert(true);
        setHasShownArrivalAlert(true);
        setTimeout(() => setShowArrivalAlert(false), 5000);
      }

      if (newStatus === 'completed' || newStatus === 'delivered') {
        if (stopLocationListenerRef.current) {
          stopLocationListenerRef.current();
          stopLocationListenerRef.current = null;
        }
        setStatusText("You've arrived at your destination");
        setTimeout(() => setIsRatingModalOpen(true), 3000);
        return;
      }

      if (newStatus === 'accepted' && order.driverId) {
        if (stopLocationListenerRef.current) {
          stopLocationListenerRef.current();
        }

        stopLocationListenerRef.current = listenToDriverLocation(order.driverId, (driverLoc) => {
          const pickupCoords = order.pickupLocation || { latitude: -26.2041, longitude: 28.0473 };
          const etaMinutes = calculateETA(driverLoc, pickupCoords);
          setStatusText(`Arriving in ${etaMinutes} min${etaMinutes !== 1 ? 's' : ''}`);
        });
      }

      if (newStatus === 'arrived') {
        if (stopLocationListenerRef.current) {
          stopLocationListenerRef.current();
          stopLocationListenerRef.current = null;
        }
        setStatusText('Your driver has arrived');
      }

      if (newStatus === 'started' && order.driverId) {
        if (stopLocationListenerRef.current) {
          stopLocationListenerRef.current();
        }

        stopLocationListenerRef.current = listenToDriverLocation(order.driverId, (driverLoc) => {
          const destinationCoords = order.destinationLocation || { latitude: -26.195, longitude: 28.04 };
          const etaMinutes = calculateETA(driverLoc, destinationCoords);
          setStatusText(`On trip — ETA ${etaMinutes} min${etaMinutes !== 1 ? 's' : ''}`);
        });
      }
    });

    return () => {
      unsubscribeOrder();
      if (stopLocationListenerRef.current) {
        stopLocationListenerRef.current();
        stopLocationListenerRef.current = null;
      }
    };
  }, [orderId, isFood, hasShownArrivalAlert, driverInfo]);

  const handleMessageDriver = async () => {
    setIsMessagePanelOpen(true);
    await markMessagesAsRead();
  };

  const handleCancelClick = () => setShowCancelConfirmation(true);
  const handleWaitForDriver = () => setShowCancelConfirmation(false);

  const handleConfirmCancel = async () => {
    try {
      const rideIdToCancel = currentRide?.id || currentRideId;
      if (!rideIdToCancel) return;

      await firebaseService.updateRideStatus(rideIdToCancel, 'cancelled');
      setShowCancelConfirmation(false);

      navigate('/what-went-wrong', {
        state: {
          rideId: rideIdToCancel,
          userId: profile?.id || 'user123',
          userName: profile?.name || 'Unknown User',
          destination,
          pickup,
          stops,
          carType,
          price: finalPrice
        }
      });
    } catch (error) {
      console.error('Error cancelling ride:', error);
      setShowCancelConfirmation(false);
    }
  };

  const handleSubmitRating = async (rating: number, feedback: string) => {
    if (!currentRideId || !currentRide?.driverId || !profile?.id) return;

    try {
      await firebaseService.submitRating(currentRide.driverId, currentRideId, rating, feedback, profile.id);
      setIsRatingModalOpen(false);
      navigate('/');
    } catch (error) {
      console.error('Error submitting rating:', error);
    }
  };

  if (!driverInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading driver information...</p>
        </div>
      </div>
    );
  }

  const isMessageDisabled = rideStatus === 'pending' || rideStatus === 'completed';

  return (
    <div className="min-h-screen relative overflow-hidden">
      <MapBackground />

      <DraggablePanel initialHeight={500} maxHeight={680} minHeight={175}>
        <div className="space-y-6 pb-6">
          <motion.div className="text-center pt-4" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{statusText}</h2>
          </motion.div>

          <motion.div className="bg-gray-50 rounded-2xl p-4" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
            <div className="flex items-center space-x-4">
              <div className="relative">
                <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center text-2xl">
                  {driverInfo.photo}
                </div>
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-lg text-gray-900">{driverInfo.plateNumber}</h3>
                <p className="text-gray-600">{driverInfo.carModel}</p>
                <p className="text-gray-900 font-medium">{driverInfo.name}</p>
              </div>
              <div className="text-3xl">🚗</div>
            </div>
          </motion.div>

          {/* Cancel + Message Row */}
          <motion.div className="bg-gray-50 rounded-xl p-4">
            <div className="flex items-center justify-between">
              {rideStatus !== 'arrived' && rideStatus !== 'started' && (
                <button onClick={handleCancelClick} className="text-sm text-red-600 font-medium hover:text-red-700 transition-colors">
                  Cancel ride
                </button>
              )}
              <motion.p
                animate={{
                  scale: [1, 1.05, 1],
                  textShadow: [
                    '0 0 0px rgba(147, 51, 234, 0)',
                    '0 0 20px rgba(147, 51, 234, 0.8)',
                    '0 0 0px rgba(147, 51, 234, 0)'
                  ]
                }}
                transition={{ repeat: Infinity, duration: 1, repeatDelay: 4 }}
                className={`text-sm text-gray-700 text-center ${rideStatus === 'arrived' || rideStatus === 'started' ? 'flex-1 text-left' : 'flex-1'}`}
              >
                Tap the message icon to chat with your driver
              </motion.p>
              <motion.button
                onClick={handleMessageDriver}
                disabled={isMessageDisabled}
                whileTap={{ scale: 0.9 }}
                whileHover={{ scale: 1.05 }}
                className={`relative p-2 rounded-full transition-colors ${isMessageDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-200'}`}
              >
                <MessageCircle className={`${isMessageDisabled ? 'text-gray-400' : 'text-gray-700'}`} size={24} />
                {unreadMessageCount > 0 && !isMessageDisabled && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold shadow-lg"
                  >
                    {unreadMessageCount}
                  </motion.span>
                )}
              </motion.button>
            </div>
          </motion.div>

          <ScrollableSection maxHeight="max-h-[420px]">
            <div className="space-y-6 pb-4">
              {isFood ? (
                <>
                  {/* Food Order Details */}
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                    <h3 className="font-semibold text-gray-900 mb-3">Food Items</h3>
                    <div className="bg-gray-50 rounded-xl p-4">
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {(foodOrderDetails?.items || orderData?.items || []).map((item: any, idx: number) => (
                          <div key={idx} className="flex justify-between text-sm">
                            <span className="text-gray-700">{item.name}</span>
                            <span className="font-medium text-gray-900">R {item.price}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>

                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                    <h3 className="font-semibold text-gray-900 mb-3">Delivery route</h3>
                    <div className="space-y-3">
                      <div className="flex items-center space-x-3">
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        <span className="flex-1 text-gray-700">{finalPickup}</span>
                      </div>

                      {finalStops.length > 0 && finalStops.map((stop: any, index: number) => (
                        <div key={index} className="flex items-center space-x-3 ml-6">
                          <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                          <span className="flex-1 text-gray-700">{stop.address || stop}</span>
                        </div>
                      ))}

                      <div className="flex items-center space-x-3">
                        <MapPin className="text-blue-600" size={12} />
                        <span className="flex-1 text-gray-700">{finalDestination}</span>
                      </div>
                    </div>
                  </motion.div>

                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                    <h3 className="font-semibold text-gray-900 mb-3">Payment summary</h3>
                    <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Food subtotal</span>
                        <span className="font-medium text-gray-900">R {foodOrderDetails?.foodSubtotal || orderData?.foodSubtotal || 0}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Delivery fee</span>
                        <span className="font-medium text-gray-900">R {foodOrderDetails?.deliveryFee || orderData?.deliveryFee || 0}</span>
                      </div>
                      <div className="flex justify-between pt-2 border-t border-gray-200">
                        <span className="font-semibold text-gray-900">Total</span>
                        <span className="text-lg font-bold text-gray-900">R {displayPrice}</span>
                      </div>
                    </div>
                  </motion.div>
                </>
              ) : (
                <>
                  {/* Ride Details */}
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                    <h3 className="font-semibold text-gray-900 mb-3">My route</h3>
                    <div className="space-y-3">
                      <div className="flex items-center space-x-3">
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        <span className="flex-1 text-gray-700">{pickup}</span>
                        <Edit className="text-gray-400" size={16} />
                      </div>

                      {stops.map((stop, index) => (
                        <div key={index} className="flex items-center space-x-3 ml-6">
                          <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                          <span className="flex-1 text-gray-700">{stop}</span>
                          <Edit className="text-gray-400" size={16} />
                        </div>
                      ))}

                      <div className="flex items-center space-x-3 ml-6">
                        <Plus className="text-blue-600" size={16} />
                        <span className="text-blue-600 font-medium">Add stop</span>
                      </div>

                      <div className="flex items-center space-x-3">
                        <MapPin className="text-blue-600" size={12} />
                        <span className="flex-1 text-gray-700">{destination}</span>
                        <Edit className="text-gray-400" size={16} />
                      </div>
                    </div>
                  </motion.div>

                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                    <h3 className="font-semibold text-gray-900 mb-3">Payment method</h3>
                    <div className="bg-gray-50 rounded-xl p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <CreditCard className="text-green-600" size={20} />
                          <div>
                            <p className="font-medium text-gray-900">Cash</p>
                            <p className="text-sm text-gray-500">Fare • {carType}</p>
                          </div>
                        </div>
                        <span className="font-bold text-gray-900">R {finalPrice}</span>
                      </div>
                    </div>
                  </motion.div>
                </>
              )}
            </div>
          </ScrollableSection>
        </div>
      </DraggablePanel>

      {/* Cancel Confirmation Modal */}
      <AnimatePresence>
        {showCancelConfirmation && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white rounded-3xl p-6 max-w-sm w-full relative"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
            >
              <button
                onClick={handleWaitForDriver}
                className="absolute top-4 right-4 w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center hover:bg-gray-300"
              >
                <X size={20} className="text-gray-600" />
              </button>

              <div className="text-center mb-6">
                <div className="relative inline-block">
                  <div className="w-24 h-24 bg-pink-100 rounded-full flex items-center justify-center mb-4">
                    <span className="text-4xl">👨🏽‍💼</span>
                  </div>
                  <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
                    <X size={16} className="text-white" />
                  </div>
                </div>
              </div>

              <h3 className="text-2xl font-bold text-gray-900 mb-4 text-center">Are you sure?</h3>
              <p className="text-gray-600 text-center mb-8 leading-relaxed">
                Do you really want to cancel the ride? Rebooking may not get you there faster.
              </p>

              <div className="space-y-3">
                <button
                  onClick={handleConfirmCancel}
                  className="w-full bg-red-500 text-white py-4 rounded-2xl font-semibold text-lg hover:bg-red-600"
                >
                  Cancel ride
                </button>
                <button
                  onClick={handleWaitForDriver}
                  className="w-full bg-gray-100 text-gray-800 py-4 rounded-2xl font-semibold text-lg hover:bg-gray-200"
                >
                  Wait for driver
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <MessagePanel
        isOpen={isMessagePanelOpen}
        onClose={() => setIsMessagePanelOpen(false)}
        rideId={orderId || ''}
        currentUserId={profile?.id || 'user123'}
        currentUserName={profile?.name || 'Client'}
        driverId={(isFood ? foodOrderDetails?.driverId : currentRide?.driverId) || 'driver123'}
        driverName={driverInfo.name}
        isRideActive
      />

      <RatingModal
        isOpen={isRatingModalOpen}
        onClose={() => {}}
        driverName={driverInfo.name}
        driverPhoto={driverInfo.photo}
        onSubmitRating={handleSubmitRating}
      />
    </div>
  );
};