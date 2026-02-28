import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { X, Plus, Calendar, Users, User, Briefcase, ChevronDown } from 'lucide-react';
import { MapBackground } from '../components/MapBackground';
import { PromoDetailsPanel } from '../components/PromoDetailsPanel';
import { carTypes } from '../data/mockData';
import { calculatePriceWithStops, getCarTypePrice } from '../utils/priceCalculation';
import { useRideContext } from '../contexts/RideContext';
import { getFleetOptions, FleetVehicle } from '../services/fleetService';

interface SelectRideProps {
  destination: string;
  pickup: string;
  stops: string[];
  onBack: () => void;
  onSelectRide: (carType: string, price: number) => void;
}

type FilterTab = 'recommended' | 'faster' | 'cheaper';

const PANEL_MIN_HEIGHT = 35;
const PANEL_MAX_HEIGHT = 85;
const SNAP_THRESHOLD = 65;

export const SelectRide: React.FC<SelectRideProps> = ({
  destination,
  pickup,
  stops,
  onBack,
  onSelectRide
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isRideActive, rideStatus } = useRideContext();
  const panelRef = useRef<HTMLDivElement>(null);

  // Read navigation state to determine service type
  const { serviceType = 'ride', extraOption } = location.state || {};

  // Calculate base price for the trip
  const priceCalculation = calculatePriceWithStops(pickup, destination, stops);

  // State for fleet vehicles
  const [fleetVehicles, setFleetVehicles] = useState<FleetVehicle[]>([]);
  const [isLoadingFleet, setIsLoadingFleet] = useState(false);

  // Create car types with calculated prices (for regular rides)
  const carsWithPrices = carTypes.map(car => ({
    ...car,
    price: getCarTypePrice(priceCalculation.totalPrice, car.name),
    originalPrice: Math.round(getCarTypePrice(priceCalculation.totalPrice, car.name) * 1.25)
  }));

  // Determine which vehicles to display
  const displayVehicles = serviceType === 'ride' ? carsWithPrices : fleetVehicles;

  const [selectedCar, setSelectedCar] = useState<any>(displayVehicles[0] || carsWithPrices[0]);
  const [showPromoDetails, setShowPromoDetails] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<FilterTab>('recommended');
  const [panelHeight, setPanelHeight] = useState(PANEL_MIN_HEIGHT);
  const [profileToggle, setProfileToggle] = useState<'personal' | 'business'>('personal');

  const isExpanded = panelHeight > SNAP_THRESHOLD;

  // Load fleet options for logistics services
  useEffect(() => {
    async function loadFleet() {
      if (serviceType !== 'ride') {
        setIsLoadingFleet(true);
        try {
          const vehicles = await getFleetOptions(serviceType as any, extraOption);
          setFleetVehicles(vehicles);
          if (vehicles.length > 0) {
            setSelectedCar(vehicles[0]);
          }
        } catch (error) {
          console.error('Failed to load fleet:', error);
        } finally {
          setIsLoadingFleet(false);
        }
      }
    }

    loadFleet();
  }, [serviceType, extraOption]);

  const promo = {
    discount: 30,
    ridesLeft: 5,
    maxPerRide: 80,
    expiryDate: 'December 29, 2025',
    paymentMethods: 'Apple Pay, Bolt balance, Google Pay, Card, Family, Cash',
    rideCategories: 'XL, Women for Women, Economy, Bolt, Comfort, Lite, Premium, XXL, Send, Business Send (excludes Scheduled Rides)',
    rideAreas: 'Gauteng'
  };

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

  const getSortedCars = () => {
    let sorted = [...displayVehicles];

    if (selectedFilter === 'faster') {
      sorted.sort((a, b) => {
        const aTime = parseInt(a.eta) || 0;
        const bTime = parseInt(b.eta) || 0;
        return aTime - bTime;
      });
    } else if (selectedFilter === 'cheaper') {
      sorted.sort((a, b) => a.price - b.price);
    }

    return sorted;
  };

  const sortedCars = getSortedCars();

  const getAddressDisplay = () => {
    const stopsText = stops.length > 0 ? ` +${stops.length} stop${stops.length > 1 ? 's' : ''}` : '';
    return `${pickup} → ${destination}${stopsText}`;
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
          Arrive by 20:38
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
            onClick={onBack}
            className="flex-shrink-0 w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded-full transition-colors"
          >
            <X size={20} className="text-gray-700" />
          </button>

          <button
            onClick={() => navigate('/your-route', {
              state: {
                highlightDestination: true,
                prefilledDestination: destination,
                prefilledPickup: pickup
              }
            })}
            className="flex-1 text-left min-w-0"
          >
            <div className="overflow-x-auto scrollbar-hide" style={{ WebkitOverflowScrolling: 'touch' }}>
              <div className="flex items-center gap-2 whitespace-nowrap">
                <span className="text-sm font-medium text-gray-900">
                  {getAddressDisplay()}
                </span>
              </div>
            </div>
          </button>

          <button
            onClick={() => navigate('/your-route', {
              state: {
                highlightAddStop: true,
                prefilledDestination: destination,
                prefilledPickup: pickup
              }
            })}
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
        <motion.div
          className="bg-blue-600 text-white w-full px-4 py-3 flex items-center justify-center gap-2 rounded-t-3xl flex-shrink-0 cursor-pointer"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          onClick={() => setShowPromoDetails(true)}
          whileTap={{ scale: 0.98 }}
        >
          <span className="text-white">✓</span>
          <span className="font-medium text-sm">{promo.discount}% promo applied</span>
          <ChevronDown size={16} />
        </motion.div>

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
                  onClick={() => setSelectedFilter('recommended')}
                  className={`px-4 py-2 rounded-full font-medium text-sm transition-all whitespace-nowrap ${
                    selectedFilter === 'recommended'
                      ? 'bg-white border-2 border-green-600 text-gray-900'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  transition={{ delay: 0.05, type: 'spring', damping: 20, stiffness: 300 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Recommended
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
          {isLoadingFleet ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                <p className="text-gray-600 text-sm">Loading vehicles...</p>
              </div>
            </div>
          ) : sortedCars.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-gray-600">No vehicles available</p>
            </div>
          ) : (
            <div className="space-y-3 mb-6">
              {sortedCars.map((car, index) => (
                <motion.button
                  key={car.id}
                  onClick={() => setSelectedCar(car)}
                  className={`w-full p-4 rounded-2xl border-2 transition-all ${
                    selectedCar?.id === car.id
                      ? 'border-green-600 bg-green-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="flex items-center space-x-4">
                    <div className="text-2xl">{car.icon}</div>
                    <div className="flex-1 text-left">
                      <div className="flex items-center justify-between">
                        <h3 className="font-bold text-gray-900">{car.name}</h3>
                        <div className="text-right">
                          <p className="font-bold text-gray-900">R {car.price}</p>
                          {car.originalPrice && (
                            <p className="text-sm text-gray-500 line-through">R {car.originalPrice}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-4 mt-1">
                        <span className="text-sm text-gray-600">{car.eta}</span>
                        {typeof car.capacity === 'number' && (
                          <div className="flex items-center space-x-1">
                            <Users size={14} className="text-gray-500" />
                            <span className="text-sm text-gray-600">{car.capacity}</span>
                          </div>
                        )}
                        {typeof car.capacity === 'string' && (
                          <span className="text-sm text-gray-600">{car.capacity}</span>
                        )}
                        <span className="text-sm text-gray-600">{car.description}</span>
                      </div>
                      {car.badge && (
                        <span
                          className={`inline-block mt-2 px-2 py-1 rounded-full text-xs font-bold ${
                            car.badge === 'FASTER' || car.badge === 'RECOMMENDED'
                              ? 'bg-green-100 text-green-800'
                              : car.badge === 'CHEAPER'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-purple-100 text-purple-800'
                          }`}
                        >
                          {car.badge}
                        </span>
                      )}
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>
          )}
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
              onClick={() => console.log('Cash payment clicked')}
              className="py-2 px-3 bg-white border border-gray-300 rounded-lg font-medium text-gray-900 hover:bg-gray-50 transition-colors flex items-center justify-center gap-1 flex-shrink-0 text-sm"
              whileTap={{ scale: 0.95 }}
            >
              Cash
              <ChevronDown size={14} />
            </motion.button>

            <div className="flex-1" />

            <motion.button
              onClick={() => navigate('/schedule-ride')}
              className="w-12 h-12 bg-green-600 text-white rounded-2xl flex items-center justify-center hover:bg-green-700 transition-colors shadow-lg flex-shrink-0"
              whileTap={{ scale: 0.95 }}
            >
              <Calendar size={20} />
            </motion.button>
          </div>

          <motion.button
            onClick={() => {
              if (isRideActive) {
                alert('You already have an active ride.');
                return;
              }
              onSelectRide(selectedCar.name, selectedCar.price);
            }}
            disabled={isRideActive}
            className={`w-full py-3 rounded-2xl font-bold text-base transition-colors shadow-lg ${
              isRideActive
                ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
            whileTap={{ scale: isRideActive ? 1 : 0.98 }}
          >
            {isRideActive ? 'Ride Active' : `Select ${selectedCar.name}`}
          </motion.button>
          {isRideActive && (
            <p className="text-gray-500 text-center text-sm mt-2">
              Finish current ride before booking another
            </p>
          )}
        </div>
      </motion.div>

      <PromoDetailsPanel
        isOpen={showPromoDetails}
        onClose={() => setShowPromoDetails(false)}
        promo={promo}
      />
    </div>
  );
};