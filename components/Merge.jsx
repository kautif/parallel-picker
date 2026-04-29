import axios from 'axios';
import { Audio } from 'expo-av';
import { router } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, BackHandler, Modal, NativeModules, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { addArrangedBackfillObj, resetParallelState } from '../../ParallelPicker/app/redux/parallelSlice';
import MergeLogger from './MergeLogger';
import ParallelLogViewer from './ParallelLogViewer';
const { AudioRouter } = NativeModules;

const Merge = () => {
    const dispatch = useDispatch();
    const [currentOrder, setCurrentOrder] = useState(null);

    const backfillsArranged = useSelector(state => state.parallel.backfillsArranged);
    const backfillItems = useSelector(state => state.parallel.backfillItems);
    const reduxOrders = useSelector(state => state.parallel.orders);
    // const initialBackfill = useSelector(state => state.parallel.initialBackfill);
    const mergedBackfills = useSelector(state => state.parallel.mergedBackfills);
    const backfillOrderIds = useSelector(state => state.parallel.backfillOrderIds);
// console.log("RAW initialBackfill:", JSON.stringify(initialBackfill.map((item, i) => ({
//     i,
//     id: item.orderBackFillItemsId,
//     upcList: item.upcList,
//     upcAliasList: item.upcAliasList
// })), null, 2));
    // const backfillOrders = useSelector(state => state.parallel.backfillOrders);
    const user = useSelector(state => state.user.user);
    // const orders = useSelector(state => state.parallel.orders);
    const [ordersToMerge, setOrdersToMerge] = useState([]);
    const [orders, setOrders] = useState([]);
    const [ordersArr, setOrdersArr] = useState([]);
    const [scanText, setScanText] = useState("");
    const [orderText, setOrderText] = useState("");
    const [containerText, setContainerText] = useState("");
    const [mergeArr, setMergeArr] = useState([]);
    const [mergeMsg, setMergeMsg] = useState("");
    const [errorMsg, setErrorMsg] = useState("");

    const [sound, setSound] = useState();

    const [modalVisible, setModalVisible] = useState(false);
    const [orderVisible, setOrderVisible] = useState(false);
    const [containerVisible, setContainerVisible] = useState(false);
    const [destContainerVisible, setDestContainerVisible] = useState(false);
    const [destContainerText, setDestContainerText] = useState("");
    const [destContainerError, setDestContainerError] = useState("");
    const [errorVisible, setErrorVisible] = useState(false);
    const mergeArrBuilt = useRef(false);
    const mergeCompletedRef = useRef(false);
    const pendingMergeItem = useRef(null);

    // Plain array instead of Set — reliable React re-renders
    const [mergedOrders, setMergedOrders] = useState([]);

    // Toast state
    const [toastMsg, setToastMsg] = useState("");
    const toastOpacity = useRef(new Animated.Value(0)).current;

    const wrongItem = require('../../WarehouseScanner/assets/sounds/wrong_item.mp3');
    const wrongContainer = require('../../WarehouseScanner/assets/sounds/wrong_container.mp3');
    const mergeDone = require('../../WarehouseScanner/assets/sounds/merge_completed.mp3');

    function showToast(msg) {
        setToastMsg(msg);
        Animated.sequence([
            Animated.timing(toastOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
            Animated.delay(2000),
            Animated.timing(toastOpacity, { toValue: 0, duration: 300, useNativeDriver: true })
        ]).start();
    }

    async function playSound (audioFile) {
            try {
                // Method 1: Expo Audio reconfiguration
                await Audio.setAudioModeAsync({
                    allowsRecordingIOS: false,
                    staysActiveInBackground: false,
                    playsInSilentModeIOS: true,
                    shouldDuckAndroid: true,
                    playThroughEarpieceAndroid: false,
                });
    
                // Method 2: Native module (if available)
                if (Platform.OS === 'android' && AudioRouter) {
                    try {
                        await AudioRouter.forceSpeakerOutput();
                    } catch (nativeError) {
                        console.log('Native audio routing failed in playSound:', nativeError.message);
                    }
                }
                
                const { sound } = await Audio.Sound.createAsync(audioFile);
                setSound(sound);
                
                // Set volume to max to ensure it's audible
                await sound.setVolumeAsync(1.0);
                await sound.playAsync();
            } catch (error) {
                console.error('Error playing sound:', error);
                // Last resort: try playing without any configuration
                try {
                    const { sound } = await Audio.Sound.createAsync(audioFile);
                    await sound.playAsync();
                } catch (fallbackError) {
                    console.error('Fallback sound play failed:', fallbackError);
                }
            }
        }

    function handleOrderPress(i, order) {
        if (mergedOrders.includes(order)) {
            showToast(`Order ${order} Already Merged`);
            return;
        }
        setCurrentOrder(i);
        setOrderText("");
        setContainerText("");
        setOrderVisible(true);
        setModalVisible(true);
    }

    // async function getBackFillDetails() {
    //     // console.log("starting getBackfill");
    //     try {
    //         const response = await axios.post('http://192.168.2.165/api/Order/getBackFillDetails', {
    //             token: "Yh2k7QSu4l8CZg5p6X3Pna9L0Miy4D3Bvt0JVr87UcOj69Kqw5R2Nmf4FWs03Hdx",
    //             EmployeeId: user.employeeID,
    //             Orders: backfillOrders
    //         });

    //         if (response.data.success) {
    //             // console.log("backfill success");
    //             dispatch(populateBackfill(response.data.data));
    //         } else {
    //             // console.log("backfill failure");
    //             // console.log(response.data.reason);
    //         }
    //     } catch (err) {
    //         console.log("backfill error");
    //         console.error(err.message);
    //         // console.log(err.response?.data?.reason);
    //     }
    // }

      async function getMergedBackfills () {
        try {
            const response = await axios.post('http://192.168.2.165/api/Order/getBackFillMergeByEmployeeId', {
                token: "Yh2k7QSu4l8CZg5p6X3Pna9L0Miy4D3Bvt0JVr87UcOj69Kqw5R2Nmf4FWs03Hdx",
                employeeId: user.employeeID
            });

            if (response.data.success) {
                if (response.data.data.length > 0) {
                    // ── Log successful getMergedBackfills ──
                    const returnedOrderIds = [...new Set(response.data.data.map(obj => String(obj.orderId)))];
                    // Build a map of orderId -> first containerBarcode seen for that order
                    const containerMap = {};
                    response.data.data.forEach(obj => {
                        if (!containerMap[obj.orderId]) containerMap[obj.orderId] = obj.containerBarcode || '';
                    });
                    const returnedContainers = returnedOrderIds.map(id => containerMap[id] || '');

                    MergeLogger.logGetMergedBackfills({
                        employeeId:   user.employeeID   || 'N/A',
                        employeeName: user.employeeName || 'Unknown',
                        httpStatus:   response.status,
                        orderIds:     returnedOrderIds,
                        containers:   returnedContainers,
                        errorMessage: ''
                    });

                    const existingIds = new Set(backfillsArranged.map(obj => obj.orderId));
                    const newObjs = response.data.data.filter(obj => !existingIds.has(obj.orderId));
                    newObjs.forEach(obj => dispatch(addArrangedBackfillObj(obj)));
                } else {
                    // Successful response but empty data — still log it
                    MergeLogger.logGetMergedBackfills({
                        employeeId:   user.employeeID   || 'N/A',
                        employeeName: user.employeeName || 'Unknown',
                        httpStatus:   response.status,
                        orderIds:     [],
                        containers:   [],
                        errorMessage: ''
                    });
                }
            } else {
                // ── Log API-level failure ──
                MergeLogger.logGetMergedBackfills({
                    employeeId:   user.employeeID   || 'N/A',
                    employeeName: user.employeeName || 'Unknown',
                    httpStatus:   response.status,
                    orderIds:     [],
                    containers:   [],
                    errorMessage: response.data.reason || 'Request failed'
                });
            }
        } catch (err) {
            console.log("merge update error");
            console.error(err.message);

            // ── Log network/exception error ──
            MergeLogger.logGetMergedBackfills({
                employeeId:   user.employeeID   || 'N/A',
                employeeName: user.employeeName || 'Unknown',
                httpStatus:   err.response?.status || 0,
                orderIds:     [],
                containers:   [],
                errorMessage: err.response?.data?.reason || err.message || 'Network error'
            });
        }
    }

    async function updateMergedItem(item, containerItems) {
        try {
            const response = await axios.post('http://192.168.2.165/api/Order/updateBackFillItemMerge', {
                token: "Yh2k7QSu4l8CZg5p6X3Pna9L0Miy4D3Bvt0JVr87UcOj69Kqw5R2Nmf4FWs03Hdx",
                employeeId: user.employeeID,
                orderBackFillItemsId: item.orderBackFillItemsId,
                pickLocation: item.pickLocation,
                scannedQty: item.mergedQty,
                containerItems
            });

            // Derive the destination container(s) from containerItems for logging
            // containerItems is [{ containerBarcode, qty }, ...] — log the most recent one
            const latestDestContainer = containerItems.length > 0
                ? containerItems[containerItems.length - 1].containerBarcode
                : 'N/A';

            if (response.data.success) {
                // ── Log successful updateMergedItem ──
                MergeLogger.logUpdateMergedItem({
                    employeeId:     user.employeeID   || 'N/A',
                    employeeName:   user.employeeName || 'Unknown',
                    scannedSku:     item.possibleScans?.[0] || 'N/A',
                    mergedQty:      item.mergedQty,
                    scannedQty:     item.scannedQty,
                    orderId:        String(item.orderId),
                    orderContainer: item.containerBarcode || 'N/A',
                    destContainer:  latestDestContainer,
                    httpStatus:     response.status,
                    errorMessage:   ''
                });
            } else {
                // ── Log API-level failure ──
                MergeLogger.logUpdateMergedItem({
                    employeeId:     user.employeeID   || 'N/A',
                    employeeName:   user.employeeName || 'Unknown',
                    scannedSku:     item.possibleScans?.[0] || 'N/A',
                    mergedQty:      item.mergedQty,
                    scannedQty:     item.scannedQty,
                    orderId:        String(item.orderId),
                    orderContainer: item.containerBarcode || 'N/A',
                    destContainer:  latestDestContainer,
                    httpStatus:     response.status,
                    errorMessage:   response.data.reason || 'Request failed'
                });
            }
        } catch (err) {
            console.log("merge update error");
            console.error(err.message);

            // ── Log network/exception error ──
            const latestDestContainer = containerItems?.length > 0
                ? containerItems[containerItems.length - 1].containerBarcode
                : 'N/A';
            MergeLogger.logUpdateMergedItem({
                employeeId:     user.employeeID   || 'N/A',
                employeeName:   user.employeeName || 'Unknown',
                scannedSku:     item?.possibleScans?.[0] || 'N/A',
                mergedQty:      item?.mergedQty ?? 0,
                scannedQty:     item?.scannedQty ?? 0,
                orderId:        String(item?.orderId || 'N/A'),
                orderContainer: item?.containerBarcode || 'N/A',
                destContainer:  latestDestContainer,
                httpStatus:     err.response?.status || 0,
                errorMessage:   err.response?.data?.reason || err.message || 'Network error'
            });
        }
    }

    async function updateMergeStatus(mergedOrderNumbers) {
        try {
            const response = await axios.post('http://192.168.2.165/api/Order/UpdateMergeCompleted', {
                token: "Yh2k7QSu4l8CZg5p6X3Pna9L0Miy4D3Bvt0JVr87UcOj69Kqw5R2Nmf4FWs03Hdx",
                employeeId: user.employeeID,
                orders: mergedOrderNumbers.map(orderNum => ({ orderId: orderNum }))
            });

            if (response.data.success) {
                // ── Log successful updateMergeStatus ──
                MergeLogger.logUpdateMergeStatus({
                    employeeId:   user.employeeID   || 'N/A',
                    employeeName: user.employeeName || 'Unknown',
                    orderNumbers: mergedOrderNumbers,
                    httpStatus:   response.status,
                    errorMessage: ''
                });
            } else {
                // ── Log API-level failure ──
                MergeLogger.logUpdateMergeStatus({
                    employeeId:   user.employeeID   || 'N/A',
                    employeeName: user.employeeName || 'Unknown',
                    orderNumbers: mergedOrderNumbers,
                    httpStatus:   response.status,
                    errorMessage: response.data.reason || 'Request failed'
                });
            }
        } catch (err) {
            console.log("merge status update error");
            console.error(err.message);

            // ── Log network/exception error ──
            MergeLogger.logUpdateMergeStatus({
                employeeId:   user.employeeID   || 'N/A',
                employeeName: user.employeeName || 'Unknown',
                orderNumbers: mergedOrderNumbers,
                httpStatus:   err.response?.status || 0,
                errorMessage: err.response?.data?.reason || err.message || 'Network error'
            });
        }
    }

    useEffect(() => {
        let subscription;

        const lockOrientation = async () => {
            await ScreenOrientation.unlockAsync();
            await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE_LEFT);
        };

        lockOrientation();

        subscription = ScreenOrientation.addOrientationChangeListener(() => {
            lockOrientation();
        });

        return () => {
            if (subscription) {
            ScreenOrientation.removeOrientationChangeListener(subscription);
            }
        };
    }, []);

    useEffect(() => {
        console.log("MERGE: ", backfillItems);
        mergeCompletedRef.current = false;
        // getBackFillDetails();
        // setMergeArr([]);

        // if (!mergedBackfills.length) {
        //     getMergedBackfills();
        // }
        getMergedBackfills();
        mergeArrBuilt.current = false;

            const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
                return true; // returning true prevents default back behavior
            });
            return () => backHandler.remove();
    }, []);

    useEffect(() => {
        if (!orderVisible || orderText.length === 0) return;

        const expectedOrder = String(orders[currentOrder]);
        const scanned = orderText.trim();

        if (scanned === expectedOrder) {
            setOrderText("");
            setOrderVisible(false);
            setContainerVisible(true);
        } else {
            showToast("Wrong order scanned. Try again.");
            setOrderText("");
        }
    }, [orderText])

    useEffect(() => {
        if (!containerVisible || containerText.length === 0) return;

        const scanned = containerText.trim();
        const orderItems = ordersArr[currentOrder]?.order ?? [];
        const expectedBarcode = orderItems[0]?.containerBarcode;

        if (scanned === expectedBarcode) {
            setContainerText("");
            setContainerVisible(false);
            setModalVisible(false);
        } else {
            showToast("Wrong container scanned. Try again.");
            playSound(wrongContainer)
            setContainerText("");
        }
    }, [containerText])

    useEffect(() => {
        if (!destContainerVisible || destContainerText.length === 0) return;

        const pending = pendingMergeItem.current;
        if (!pending) return;

        const scanned = destContainerText.trim();
        const { item, matchIndex, increment, currentOrderId, currentOrderLabel, updated } = pending;

        const allLocations = new Set(
            mergeArr.flatMap(i => [i.location, i.binLocation, i.pickLocation].filter(Boolean))
        );
        const allSkus = new Set(
            mergeArr.flatMap(i => [
                ...i.possibleScans,
                ...i.upcList.map(u => u.upc)
            ])
        );
        const allContainers = new Set(
            mergeArr.map(i => i.containerBarcode).filter(Boolean)
        );

        if (allLocations.has(scanned)) {
            setDestContainerError("Invalid: cannot use a location as destination container.");
            playSound(wrongContainer);
            setDestContainerText("");
            return;
        }
        if (allSkus.has(scanned)) {
            setDestContainerError("Invalid: cannot use an item SKU as destination container.");
            playSound(wrongContainer);
            setDestContainerText("");
            return;
        }
        if (allContainers.has(scanned)) {
            setDestContainerError("Invalid: cannot use an order container as destination container.");
            playSound(wrongContainer);
            setDestContainerText("");
            return;
        }

        // Upsert into containerItems: increment qty if barcode already exists, else add new entry
        const existingContainerIndex = item.containerItems.findIndex(
            c => c.containerBarcode === scanned
        );
        const updatedContainerItems = [...item.containerItems];
        if (existingContainerIndex !== -1) {
            updatedContainerItems[existingContainerIndex] = {
                ...updatedContainerItems[existingContainerIndex],
                qty: updatedContainerItems[existingContainerIndex].qty + increment
            };
        } else {
            updatedContainerItems.push({ containerBarcode: scanned, qty: increment });
        }

        // Write the updated containerItems back onto the item in mergeArr
        const updatedItem = { ...item, containerItems: updatedContainerItems };
        const updatedArr = [...updated];
        updatedArr[matchIndex] = updatedItem;

        setMergeArr(updatedArr);

        pendingMergeItem.current = null;
        setDestContainerText("");
        setDestContainerError("");
        setDestContainerVisible(false);

        // Only call the API once all quantities for this item have been assigned
        if (updatedItem.mergedQty === updatedItem.scannedQty) {
            updateMergedItem(updatedItem, updatedContainerItems).then(() => {
                const orderStillHasItems = updatedArr.some(
                    i => parseInt(i.orderId) === currentOrderId && i.mergedQty < i.scannedQty
                );

                if (!orderStillHasItems) {
                    setMergedOrders(prev => [...prev, currentOrderLabel]);
                    setMergeMsg(`${currentOrderLabel} merged`);
                    setCurrentOrder(null);
                    setModalVisible(true);
                } else {
                    setModalVisible(false);
                }
            });
        } else {
            setModalVisible(false);
        }
    }, [destContainerText])

    // useEffect(() => {
    //     if (backfillsArranged.length > 0) {
    //         const uniqueOrderIds = [...new Set(backfillsArranged.map(item => item.orderId))];
    //         setOrders(uniqueOrderIds);
    //         const grouped = backfillsArranged.reduce((acc, item) => {
    //             const existing = acc.find(obj => obj.orderId === item.orderId);
    //             if (existing) {
    //                 existing.order.push(item);
    //             } else {
    //                 acc.push({ orderId: item.orderId, order: [item] });
    //             }
    //             return acc;
    //         }, []);
    //         setOrdersArr(grouped);
    //     }
    // }, [backfillsArranged])

    useEffect(() => {
        console.log("arranged: ", backfillsArranged);
        if (backfillsArranged.length > 0) {
            const flatItems = backfillsArranged.flat().filter(
                (item, index, self) =>
                    index === self.findIndex(i => i.orderBackFillItemsId === item.orderBackFillItemsId)
            ).map(item => ({ ...item, orderId: String(item.orderId) }));

            const uniqueOrderIds = [...new Set(flatItems.map(item => String(item.orderId)))];
            setOrders(uniqueOrderIds);

            const grouped = flatItems.reduce((acc, item) => {
                const existing = acc.find(obj => obj.orderId === item.orderId);
                if (existing) {
                    existing.order.push(item);
                } else {
                    acc.push({ orderId: item.orderId, order: [item] });
                }
                return acc;
            }, []);

            setOrdersArr(grouped);

            const alreadyMerged = grouped
                .filter(obj => obj.order.every(item => item.mergeCompleted === true))
                .map(obj => obj.orderId);

            if (alreadyMerged.length > 0) {
                setMergedOrders(prev => {
                    const combined = [...prev];
                    alreadyMerged.forEach(id => {
                        if (!combined.includes(id)) combined.push(id);
                    });
                    return combined;
                });
            }
        }
    }, [backfillsArranged]);

    useEffect(() => {
        console.log("orders: ", orders);
    }, [orders])

    // useEffect(() => {
    //     if (backfillsArranged.length > 0) {
    //         const uniqueOrderIds = backfillsArranged.map(obj => obj.orderId);
    //         setOrders(uniqueOrderIds);
    //         setOrdersArr(backfillsArranged); // already in { orderId, order[] } shape
    //     }
    // }, [backfillsArranged])

    // useEffect(() => {
    //     if (!initialBackfill.length || mergedBackfills.length) return;
    //     console.log("merge initialBackfill");
    //     const built = orders.length > 0 ? orders.map(orderId => {
    //         const order = initialBackfill.filter(
    //             item => parseInt(item.orderId) === parseInt(orderId)
    //         );
    //         const totalQty = order.reduce((sum, item) => sum + item.scannedQty, 0);
    //         return { orderId, order, totalQty };
    //     }) : [];

    //     setOrdersArr(built);
    //     mergeArrBuilt.current = false;
    // }, [initialBackfill]);

    // useEffect(() => {
    //     if (ordersArr.length === 0 || mergeArrBuilt.current) return;

    //     mergeArrBuilt.current = true;

    //     const built = backfillsArranged.length > 0 ? backfillsArranged.map(item => ({
    //         orderId: item.orderId,
    //         orderBackFillItemsId: item.orderBackFillItemsId,
    //         description: item.description,
    //         possibleScans: [
    //             item.itemLookupCode,
    //             ...(item.upcAliasList ?? []).map(alias => alias.upc)
    //         ],
    //         upcList: (item.upcList ?? []).map(u => ({
    //             upc: u.upc,
    //             multiplier: u.sellingUnitMultiplier
    //         })),
    //         scannedQty: item.scannedQty,
    //         mergedQty: 0,
    //         pickLocation: item.pickLocation,
    //         containerBarcode: item.containerBarcode
    //     })) : [];

    //     setMergeArr(built);
    // }, [ordersArr]);

    useEffect(() => {
        console.log("OrdersArr: ", ordersArr[0]);
        if (ordersArr.length === 0 || mergeArrBuilt.current) return;

        mergeArrBuilt.current = true;

        const flatItems = backfillsArranged.flat().filter(
            (item, index, self) =>
                index === self.findIndex(i => i.orderBackFillItemsId === item.orderBackFillItemsId)
        );

        const built = flatItems.length > 0 ? flatItems.map(item => ({
            orderId: item.orderId,
            orderBackFillItemsId: item.orderBackFillItemsId,
            description: item.description,
            possibleScans: [
                item.itemLookupCode,
                ...(item.upcAliasList ?? []).map(alias => alias.upc)
            ],
            upcList: (item.upcList ?? []).map(u => ({
                upc: u.upc,
                multiplier: u.sellingUnitMultiplier
            })),
            scannedQty: item.scannedQty,
            mergedQty: 0,
            containerItems: [],
            location: item.location,
            binLocation: item.binLocation,
            pickLocation: item.pickLocation,
            containerBarcode: item.containerBarcode
        })) : [];

        setMergeArr(built);
    }, [ordersArr]);

    useEffect(() => {
        const filterByOrderId = (arr, id) => {
            return arr.filter(obj => obj.orderId === id);
        };

        if (currentOrder !== null) {
            filterByOrderId(mergeArr, parseInt(orders[currentOrder]));
        } else {
            getMergedBackfills();
        }
    }, [currentOrder]);

    useEffect(() => {
        // console.log("mergeArr: ", mergeArr);
    }, [mergeArr]);

    useEffect(() => {
        if (reduxOrders.length > 0 && mergedOrders.length === reduxOrders.length) {
            if (mergeCompletedRef.current) return;
            mergeCompletedRef.current = true;
            playSound(mergeDone);
            setMergeMsg("All orders have been successfully merged!");
            setModalVisible(true);
        }
    }, [mergedOrders]);

    useEffect(() => {
        console.log("scanText:", scanText);
        console.log("currentOrder:", currentOrder);
        console.log("mergeArr length:", mergeArr.length);
        if (!scanText.length || currentOrder === null || !mergeArr.length) return;

        const currentOrderId = parseInt(ordersArr[currentOrder]?.orderId);
        // Capture the order label NOW, before any async work nulls currentOrder
        const currentOrderLabel = ordersArr[currentOrder]?.orderId;
        console.log("currentOrderId:", currentOrderId);

        const matchIndex = mergeArr.findIndex(
            item =>
                item.orderId === currentOrderId &&
                (item.possibleScans.includes(scanText) || item.upcList.some(u => u.upc === scanText))
        );

        if (matchIndex === -1) {
            // console.log("NO MATCH");
            setErrorMsg("Invalid SKU");
            playSound(wrongItem);
            setModalVisible(true);
            setScanText("");
            return;
        }

        console.log("matchIndex:", matchIndex);

        setMergeArr(prev => {
            const updated = [...prev];
            const matched = { ...updated[matchIndex] };

            const upcListMatch = matched.upcList.find(u => u.upc === scanText);
            const increment = upcListMatch ? upcListMatch.multiplier : 1;

            if (matched.mergedQty + increment > matched.scannedQty) {
                setErrorMsg(`Cannot exceed expected quantity of ${matched.scannedQty}`);
                setModalVisible(true);
                setScanText("");
                return prev;
            }

            matched.mergedQty += increment;
            updated[matchIndex] = matched;

            // Always prompt for a destination container after every individual scan
            pendingMergeItem.current = {
                item: matched,
                matchIndex,
                increment,
                currentOrderId,
                currentOrderLabel,
                updated
            };
            setDestContainerText("");
            setDestContainerError("");
            setDestContainerVisible(true);
            setModalVisible(true);

            return updated;
        });

        setScanText("");
    }, [scanText]);

    return (
        <SafeAreaView>
            {orders.length > 0 && orders.map((order, i) => {
                if (currentOrder !== null) return null;
                const isMerged = mergedOrders.includes(order);
                const orderItems = ordersArr[i]?.order ?? [];
                const isInProgress = !isMerged && orderItems.some(item => item.mergeCompleted === true);
                const customerNumber = orderItems[0]?.customerNumber;
                return (
                    <TouchableOpacity key={order} onPress={() => handleOrderPress(i, order)}>
                        <View style={styles.orderRow}>
                            <Text style={[styles.orderNum, isMerged && styles.orderNumMerged]}>
                                {order}{customerNumber ? ` - ${customerNumber}` : ''}
                            </Text>
                            {isMerged && (
                                <Text style={styles.checkmark}>✓</Text>
                            )}
                            {isInProgress && (
                                <Text style={styles.inProgress}>⏳</Text>
                            )}
                        </View>
                    </TouchableOpacity>
                );
            })}
            <Modal
                animationType="slide"
                transparent={true}
                visible={modalVisible || errorVisible || orderVisible || containerVisible || destContainerVisible}
                onRequestClose={() => {
                    setMergeMsg("");
                    setModalVisible(false);
                    setErrorMsg("");
                    setErrorVisible(false);
                }}
            >
                <View style={styles.centeredView}>
                    {(orderVisible === false && containerVisible === false && destContainerVisible === false) && <View style={styles.modalView}>
                        <Text style={styles.modalText}>{mergeMsg || errorMsg}</Text>
                        <TouchableOpacity
                            style={{...styles.button, marginLeft: 'auto', marginRight: 'auto', marginTop: '20', backgroundColor: "rgb(0, 85, 165)", paddingHorizontal: 20, textAlign: 'center'}}
                            onPress={async () => {
                                if (mergedOrders.length === reduxOrders.length) {
                                    await updateMergeStatus(mergedOrders);
                                    dispatch(resetParallelState());
                                    setMergeMsg("");
                                    setModalVisible(false);
                                    setErrorMsg("");
                                    setErrorVisible(false);
                                    router.replace('../../warehouse/scan');
                                } else {
                                    setMergeMsg("");
                                    setModalVisible(false);
                                    setErrorMsg("");
                                    setErrorVisible(false);
                                }
                            }}
                        >
                            <Text style={{color: 'white', fontSize: 20}}>Close</Text>
                        </TouchableOpacity>
                    </View>}
                    {orderVisible && <View style={{backgroundColor: 'white', padding: 20, borderRadius: 10, borderWidth: 2}}>
                        <Text style={styles.modalText}>Verify Order</Text>
                        <Text style={styles.modalText}>Scan order {orders[currentOrder]}</Text>
                        <TextInput
                            style={styles.TextInput}
                            autoFocus={true}
                            showSoftInputOnFocus={false}
                            onChangeText={(newVal) => setOrderText(newVal)}
                            value={orderText}
                        />
                    </View>}
                    {containerVisible && <View style={{backgroundColor: 'white', padding: 20, borderRadius: 10, borderWidth: 2}}hmmm>
                        <Text style={styles.modalText}>Verify Container</Text>
                        <Text style={styles.modalText}>
                            Expected: {ordersArr[currentOrder]?.order?.[0]?.containerBarcode}
                        </Text>
                        <TextInput
                            style={styles.TextInput}
                            autoFocus={true}
                            showSoftInputOnFocus={false}
                            onChangeText={(newVal) => setContainerText(newVal)}
                            value={containerText}
                        />
                    </View>}
                    {destContainerVisible && <View style={{backgroundColor: 'white', padding: 20, borderRadius: 10, borderWidth: 2}}>
                        <Text style={styles.modalText}>Scan Destination Container</Text>
                        <Text style={styles.modalText}>{pendingMergeItem.current?.item?.description}</Text>
                        {destContainerError.length > 0 && (
                            <Text style={{color: 'red', fontSize: 16, marginTop: 8, textAlign: 'center'}}>{destContainerError}</Text>
                        )}
                        <TextInput
                            style={styles.TextInput}
                            autoFocus={true}
                            showSoftInputOnFocus={false}
                            onChangeText={(newVal) => setDestContainerText(newVal)}
                            value={destContainerText}
                        />
                    </View>}
                </View>
            </Modal>
            {currentOrder !== null && ordersArr[currentOrder] &&
    <SafeAreaView>
        <View style={styles.mergeContainer}>
            <View style={styles.leftPanel}>
                <Text>
                    {mergeArr
                        .filter(item => parseInt(item.orderId) === parseInt(ordersArr[currentOrder]?.orderId))
                        .reduce((sum, item) => sum + item.mergedQty, 0)
                    } / {mergeArr
                        .filter(item => parseInt(item.orderId) === parseInt(ordersArr[currentOrder]?.orderId))
                        .reduce((sum, item) => sum + item.scannedQty, 0)
                    }
                </Text>
                <Text style={styles.orderNum}>
                    {orders[currentOrder]}
                    {ordersArr[currentOrder]?.order?.[0]?.customerNumber ? ` - ${ordersArr[currentOrder].order[0].customerNumber}` : ''}
                </Text>
                <Text>Scan Items</Text>
                <TextInput
                    style={styles.TextInput}
                    autoFocus={true}
                    showSoftInputOnFocus={false}
                    onChangeText={(newVal) => setScanText(newVal)}
                    value={scanText}
                />
                <TouchableOpacity
                    style={styles.clearButton}
                    onPress={() => setScanText("")}
                >
                    <Text style={styles.clearButtonText}>Clear</Text>
                </TouchableOpacity>
                {/* <TouchableOpacity
                    style={{...styles.clearButton, ...styles.cancelButton}}
                    onPress={() => setCurrentOrder(null)}
                >
                    <Text style={styles.clearButtonText}>Back</Text>
                </TouchableOpacity> */}
            </View>
            <ScrollView style={styles.rightPanel}>
                {mergeArr.length > 0 && mergeArr
                    .filter(item => parseInt(item.orderId) === parseInt(ordersArr[currentOrder]?.orderId))
                    .map(item => (
                        <Text 
                            key={item.orderBackFillItemsId}
                            style={{ backgroundColor: item.mergedQty === item.scannedQty ? 'green' : item.mergedQty > 0 ? 'yellow' : '' }}
                        >
                            {item.description} — {item.mergedQty} / {item.scannedQty}
                        </Text>
                    ))
                }
            </ScrollView>
        </View>
    </SafeAreaView>
    }
            {/* Toast notification */}
            <Animated.View style={[styles.toast, { opacity: toastOpacity }]} pointerEvents="none">
                <Text style={styles.toastText}>{toastMsg}</Text>
            </Animated.View>
            {/* Floating log viewer — bottom-left, clear of any modals */}
            <ParallelLogViewer />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    orderNum: {
        fontSize: 32,
        marginBottom: 30,
        marginStart: 15
    },
    orderNumMerged: {
        color: '#999',
    },
    orderRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    checkmark: {
        fontSize: 28,
        color: 'green',
        marginLeft: 10,
        marginBottom: 30,
        fontWeight: 'bold',
    },
    inProgress: {
        fontSize: 28,
        marginLeft: 10,
        marginBottom: 30,
    },
    TextInput: {
        width: 200,
        height: 40,
        backgroundColor: 'white',
        borderColor: 'black',
        borderWidth: 1,
        borderRadius: 10,
        marginTop: 10
    },
    clearButton: {
        marginTop: 20,
        backgroundColor: 'rgb(0, 85, 165)',
        padding: 10,
        width: 150,
    },
    cancelButton: {
        backgroundColor: '#ba1212'
    },
    clearButtonText: {
        color: '#fff',
        textAlign: 'center',
        fontSize: 18,
        fontWeight: 'bold',
    },
    modalContainer: {
        flex: 1,
        position: 'absolute',
        backgroundColor: 'black',
        justifyContent: 'center',
        alignItems: 'center',
        width: 600
    },
    centeredView: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        width: 600
    },
    modalView: {
        margin: 20,
        backgroundColor: 'white',
        borderRadius: 20,
        padding: 35,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    modalText: {
        marginBottom: 5,
        textAlign: 'center',
        fontSize: 20
    },
    button: {
        borderRadius: 10,
        padding: 10,
        elevation: 2,
        backgroundColor: 'rgb(0, 85, 165)',
        width: '20%',
        marginLeft: 75,
    },
    mergeContainer: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    leftPanel: {
        flexDirection: 'column',
    },
    rightPanel: {
        flex: 1,
        marginLeft: 20,
        maxHeight: 200,
    },
    toast: {
        position: 'absolute',
        bottom: -60,
        left: 200,
        alignSelf: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 24,
    },
    toastText: {
        color: '#fff',
        fontSize: 16,
        textAlign: 'center',
    },
});

export default Merge;