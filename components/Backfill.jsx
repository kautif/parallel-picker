import axios from 'axios';
import { Audio } from 'expo-av';
import { router } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Modal, NativeModules, Platform, Text, TextInput, ToastAndroid, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { clearUser, setUsername } from '../../WarehouseScanner/app/redux/userSlice';
import { addVerifiedOrder, removeBackfillItem } from '../app/redux/parallelSlice';
import styles from './Backfill.styles';
import BackfillLogger from './BackfillLogger';
import ParallelLogViewer from './ParallelLogViewer';

const Backfill = ({navigation}) => {
    const [atLocation, setAtLocation] = useState(false);
    const [lastLocation, setLastLocation] = useState("");

    const [locations, setLocations] = useState([]);
    const [orderedLocs, setOrderedLocs] = useState([]);
    const [scannedLoc, setScannedLoc] = useState("");
    const [requiredOrders, setRequiredOrders] = useState([]);
    // const [verifiedOrders, setVerifiedOrders] = useState([]);
    const [verifyOrderVal, setVerifyOrderVal] = useState([]);

    // const [toteScanned, setToteScanned] = useState(false);
    const [tote, setTote] = useState("");
    const [toteScanned, setToteScanned] = useState(false);

    const [orderedItem, setOrderedItem] = useState("");
    const [skus, setSkus] = useState([]);
    const [upcs, setUpcs] = useState([]);
    const [itemName, setItemName] = useState("");
    const [scannedItem, setScannedItem] = useState("");
    const [sNo, setSno] = useState(0);

    const [aliasLists, setAliasLists] = useState([]);
    const [itemMultipliers, setMultipliers] = useState([]);

    const [orderedQty, setOrderedQty] = useState(0);
    const [scannedQty, setScannedQty] = useState(0);
    const [scannedBefore, setScannedBefore] = useState(false);

    // Tracks which location was already scanned so we can enforce the alternate on the next pass
    const [firstScannedLoc, setFirstScannedLoc] = useState("");
    // When true, the item has been through a Not Have at one location and must be scanned at the other
    const [alternateLocRequired, setAlternateLocRequired] = useState(false);
    // When true (single-location edge case), skip straight to tote scan and remove item on success
    const [awaitingToteOnlyRemoval, setAwaitingToteOnlyRemoval] = useState(false);
    // When true, user must scan the tote/containerBarcode after Not Have before continuing
    const [requireToteAfterNotHave, setRequireToteAfterNotHave] = useState(false);
    // When true, user tapped "Unavailable All Locations" at the first location.
    // Skip the alternate-location step entirely and finalize after tote scan (if needed).
    const [unavailableAllLocations, setUnavailableAllLocations] = useState(false);

    // const [container, setContainers] = useState();
    const [lastQty, setLastQty] = useState(0);
    
    const [errorMsg, setErrorMsg] = useState("");
    const [sending, setSending] = useState(false);
    const [orderComplete, setOrderComplete] = useState(false);
    const [backfillCompleted, setBackfillCompleted] = useState(false);
    const [picksCompleted, setPicksCompleted] = useState(0);

    const [itemDescriptionVisible, setItemDescriptionVisible] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [notHaveVisible, setNotHaveVisible] = useState(false);
    const [bfModalVisible, setBfModalVisible] = useState(false);
    const [showKeyboard, setShowKeyboard] = useState(false);
    const [logoutVisible, setLogoutVisible] = useState(false);
    const [sound, setSound] = useState();

    const dispatch = useDispatch();
    const orders = useSelector(state => state.parallel.orders);
    const verifiedOrders = useSelector(state => state.parallel.verifiedOrders);
    const backfillItems = useSelector(state => state.parallel.backfillItems);
    const backfillOrderIds = useSelector(state => state.parallel.backfillOrderIds);
    const backfillsArranged = useSelector(state => state.parallel.backfillsArranged);
    const isReturning = useSelector(state => state.parallel.isReturning);
    const picksStarted = useSelector(state => state.parallel.picksStarted);
    let username = useSelector(state => state.user.name);
    const user = useSelector(state => state.user.user);

    const scanLocRef = useRef(null);
    const toteRef = useRef(null);
    const itemRef = useRef(null);
    const scannedLocValueRef = useRef('');
    const isUpdatingQty = useRef(false);
    const backfillCompletedRef = useRef(false);
    // Persists the last successfully verified location across state resets so the
    // backfillItems effect can check it before the atLocation effect clears scannedLoc.
    const lastVerifiedLocRef = useRef('');
    // Accumulates { pickLocation, qty } entries as the user works through locations.
    // Only sent to the API once the item is fully done (tote scanned or both locations exhausted).
    const pickedLocationsRef = useRef([]);
    // Set to true synchronously in updateQty when the next item shares the current location,
    // so the atLocation effect can skip the reset before backfillItems has updated.
    const skipLocationScanRef = useRef(false);

    const { AudioRouter } = NativeModules;

    const backfillOrderIdsRef = useRef(backfillOrderIds);
    useEffect(() => {
        backfillOrderIdsRef.current = backfillOrderIds;
    }, [backfillOrderIds]);

    const nextItem = require('../../WarehouseScanner/assets/sounds/next_item.mp3');
    const buzzer = require('../../WarehouseScanner/assets/sounds/buzzer.mp3');
    const scanContainerSound = require('../../WarehouseScanner/assets/sounds/scan_container.mp3');
    const wrongLocation = require('../../WarehouseScanner/assets/sounds/wrong_location.mp3');
    const wrongItem = require('../../WarehouseScanner/assets/sounds/wrong_item.mp3');
    const pickItem = require('../../WarehouseScanner/assets/sounds/pick_item.mp3');
    const scanContainerFail = require('../../WarehouseScanner/assets/sounds/wrong_container.mp3');
    const backfillDoneSound = require('../../WarehouseScanner/assets/sounds/backfill_completed.mp3');
    const loadingAnim = require('../../WarehouseScanner/assets/images/loading.webp');
    const editIcon = require('../../WarehouseScanner/assets/images/edit.png');
    const logoutDoor = require('../../WarehouseScanner/assets/images/logout_door.png');

    useEffect(() => {
        // playSound(nextItem);
        const setupAudio = async () => {
            try {
                await Audio.setAudioModeAsync({
                    allowsRecordingIOS: false,
                    staysActiveInBackground: false,
                    playsInSilentModeIOS: true,
                    shouldDuckAndroid: true,
                    playThroughEarpieceAndroid: false,
                });
                
                if (Platform.OS === 'android' && AudioRouter) {
                    await AudioRouter.forceSpeakerOutput();
                }
            } catch (e) {
                console.log("Audio setup error:", e);
            }
        };
        setupAudio();

        // NOTE: We used to dispatch addArrangedBackfillObj here with empty stubs
        // ({ orderId, order: [] }) for every order ID. Backfill itself never
        // reads those stubs, but they caused a bug downstream: Merge's
        // getMergedBackfills skips any orderId that's already present in
        // backfillsArranged, so the stubs would block the real API data from
        // being added for the first order. That's why the first order's
        // customerNumber was missing, its item list was empty, and React warned
        // about a duplicate key (stubs have no orderBackFillItemsId).
        // Merge already fetches and populates backfillsArranged on its own.

        if (backfillItems.length > 0) {
            console.log("backfillItems: ", backfillItems[0].orderId);
            let responseArr = [];
            const newLocations = [];
            const newSkus = [];
            const newUpcs = [];
            const newAliasLists = [];
            const newMultipliers = [];
            let picksCount = 0;
            let hasScannedBefore = false;

            for (let i = 0; i < backfillItems.length; i++) {
                newLocations.push(backfillItems[i].location);
                newLocations.push(backfillItems[i].binLocation);
                newSkus.push(backfillItems[i].gamacode);
                newUpcs.push(backfillItems[i].itemLookupCode);
                newAliasLists.push(backfillItems[i].upcAliasList);
                newMultipliers.push(backfillItems[i].upcList);

                if (backfillItems[i].pickCompleted === false) {
                    picksCount++;
                    responseArr.push(backfillItems[i]);
                }

                if ((backfillItems[i].scannedQty > 0 || backfillItems[i].pickCompleted === true) && !hasScannedBefore) {
                    hasScannedBefore = true;
                }
            }
            
            // Batch all state updates together
            setLocations(prev => [...prev, ...newLocations]);
            setSkus(prev => [...prev, ...newSkus]);
            setUpcs(prev => [...prev, ...newUpcs]);
            setAliasLists(prev => [...prev, ...newAliasLists]);
            setMultipliers(prev => [...prev, ...newMultipliers]);
            setPicksCompleted(prev => prev + picksCount);
            // setTotalLocations(responseArr.length);
            if (hasScannedBefore) {
                setScannedBefore(true);
            }
        }

        backfillOrderIds.map(item => {
            if (requiredOrders.length < backfillOrderIds.length) {
                setRequiredOrders(prevId => [...prevId, String(item.orderId)]);
            }
        })

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
    }, [])

    useEffect(() => {
        console.log('reqd orders: ', requiredOrders.length);
        if (requiredOrders.length === 0) {
            // dispatch(setIsReturning(false)); 
        } else {
            // dispatch(setIsReturning(true));
        }
    }, [requiredOrders])

 useEffect(() => {
    if (atLocation === false && backfillItems.length > 0) {
        // PREVENT RESET: If we are skipping, don't clear the text field or play "next location" sound
        if (skipLocationScanRef.current) {
            return; 
        }

        const nextBackfillItem = backfillItems[0];
        setOrderedLocs([nextBackfillItem.location, nextBackfillItem.binLocation]);
        setItemName(nextBackfillItem.description);
        setScannedLoc(""); 
        playSound(nextItem);
    } else if (atLocation === true) {
        itemRef.current?.focus();
        playSound(pickItem);
    }
}, [atLocation]);

    useEffect(() => {
        if (backfillItems.length > 0) {
            const nextItem = backfillItems[0];
            
            // ALWAYS update these so the user sees the new SKU to pick
            setOrderedItem(nextItem.gamacode);
            setItemName(nextItem.description);
            setOrderedLocs([nextItem.location, nextItem.binLocation]);

            if (skipLocationScanRef.current) {
                console.log("Skipping scan, staying at:", lastVerifiedLocRef.current);
                setAtLocation(true);
                skipLocationScanRef.current = false; // Reset the flag
                // atLocation was already true, so setAtLocation(true) is a no-op and the
                // [atLocation] effect won't re-run to focus itemRef. Focus it directly here,
                // and play the pick sound so the UX matches a normal location-verified transition.
                setTimeout(() => {
                    itemRef.current?.focus();
                    playSound(pickItem);
                }, 0);
            }
        } else if (backfillItems.length === 0 && backfillCompletedRef.current === false) {
            updateBackfill();
        }
    }, [backfillItems]);

    useEffect(() => {
        if (backfillCompleted === true) {
            router.push('./merge');
        }
    }, [backfillCompleted])

    useEffect(() => {
        if (showKeyboard === true) {
            showToast("Keyboard Enabled");
        } else {
            showToast("Keyboard Disabled");
        }
    }, [showKeyboard])

    useEffect(() => {
        if ((orderedItem !== scannedItem && scannedItem.length > 0) && atLocation) {
            playSound(wrongItem);
            setErrorMsg(`Wrong Item \n ${scannedItem}`);
            if (!backfillCompletedRef.current) setModalVisible(true);
        }
    }, [orderedItem])

    useEffect(() => {
        setScannedItem("");
        console.log("scannedQty useEffect");
        if (backfillItems.length > 0 && scannedQty >= backfillItems[0].orderedQty) {
            setTimeout(() => {
                toteRef.current?.focus();
                playSound(scanContainerSound);
            }, 500)
        }
    }, [scannedQty, alternateLocRequired])

    useEffect(() => {
        console.log("tote useEffect");
        if (backfillItems.length > 0 && tote === backfillItems[0].containerBarcode && scannedQty >= backfillItems[0].orderedQty) {
            console.log("quantity and tote satisfied");
            // Append the current location's entry then fire the single API call.
            pickedLocationsRef.current = [
                ...pickedLocationsRef.current,
                { pickLocation: scannedLoc, qty: scannedQty - (pickedLocationsRef.current[0]?.qty ?? 0) }
            ];
            updateQty();
        } else if (awaitingToteOnlyRemoval && backfillItems.length > 0 && tote === backfillItems[0].containerBarcode) {
            // Single-location edge case: qty was Not Have'd at the only location.
            // pickedLocationsRef already has that entry from storeFirstLocationAndAdvance.
            // Just call updateQty — it will send the single entry and remove the item.
            console.log("tote-only removal triggered");
            updateQty();
        } else if (backfillItems.length > 0 && tote.length > 0 && tote != backfillItems[0].containerBarcode) {
            console.log("TOTE MISMATCH");
            setErrorMsg(`Wrong Tote \n SCAN ${backfillItems[0].containerBarcode}`);
            if (!backfillCompletedRef.current) setModalVisible(true);
            setTote("");
        }
    }, [tote, awaitingToteOnlyRemoval])

    // 1. At the top of your component, change the state to a Ref
    const soundRef = useRef(null); 

    // 2. Update the function
    async function playSound(audioFile) {
        try {
            // Unload previous sound using the REF
            if (soundRef.current) {
                await soundRef.current.unloadAsync();
            }

            const { sound: newSound } = await Audio.Sound.createAsync(
                audioFile,
                { shouldPlay: true, volume: 1.0 }
            );

            soundRef.current = newSound; // Store in ref immediately

            newSound.setOnPlaybackStatusUpdate((status) => {
                if (status.didJustFinish) {
                    newSound.unloadAsync();
                    soundRef.current = null;
                }
            });

        } catch (error) {
            console.error('Error playing sound:', error);
        }
    }

    const handleLogout = async () => {
        try {
            // console.log("=== LOGOUT START ===");
            // console.log("LOGOUT - resetting orderIdRef from", orderIdRef.current, "to empty string");
            // console.log(`Total effect instances created: ${effectCountRef.current}`);
            // console.log(`Total sendOrderId calls: ${sendOrderIdCallCount.current}`);

            if (order.length > 0 && totalItemsScanned > 0 && scannedQty > 0) {
                console.log("logout qty updated");
                // await updateQty(); // ensure update completes
            }
            dispatch(clearUser());  
            orderIdRef.current = '';
            dispatch(setUsername(''));
            setLogoutVisible(false);
        } catch (err) {

        }
        // navigation.navigate('Scan');
        // navigation.reset({
        //     index: 0,
        //     routes: [{ name: 'Scan' }],
        // });

        router.replace('/');
    };

    const updateQty = useCallback(async () => {
        if (isUpdatingQty.current) return;
        isUpdatingQty.current = true;
        console.log("UPDATING backfill quantity");
        console.log("employee id: ", user.employeeID);
        console.log("order id: ", backfillItems[0].orderId);
        console.log("item id: ", backfillItems[0].orderBackFillItemsId);
        console.log("pickLocations: ", pickedLocationsRef.current);
        try {
            setLastLocation(pickedLocationsRef.current);
            const response = await axios.post('http://192.168.2.165/api/Order/updateBackFillDetails', {
                token: 'Yh2k7QSu4l8CZg5p6X3Pna9L0Miy4D3Bvt0JVr87UcOj69Kqw5R2Nmf4FWs03Hdx',
                employeeId: user.employeeID,
                orderBackFillItemsId: backfillItems[0].orderBackFillItemsId,
                pickLocations: pickedLocationsRef.current,
            });

            if (!response.data.success) {
                // ── Log failed updateQty ──
                BackfillLogger.logUpdateQty({
                    employeeId:       user.employeeID   || 'N/A',
                    employeeName:     user.employeeName || username || 'Unknown',
                    pickLocations:    pickedLocationsRef.current,
                    itemSku:          backfillItems[0].gamacode,
                    orderedQty:       backfillItems[0].orderedQty,
                    scannedQty:       pickedLocationsRef.current.reduce((sum, loc) => sum + (loc.qty ?? 0), 0),
                    containerBarcode: backfillItems[0].containerBarcode,
                    httpStatus:       response.status,
                    errorMessage:     response.data.reason || 'Request failed'
                });

                setErrorMsg(response.data.reason);
                if (!backfillCompletedRef.current) setModalVisible(trFue);
                isUpdatingQty.current = false;
                setTimeout(() => {
                    setModalVisible(false);
                    setOrderNum("");
                    setErrorMsg("");
                }, 2000);
            } else {
                // ── Log successful updateQty ──
                BackfillLogger.logUpdateQty({
                    employeeId:       user.employeeID   || 'N/A',
                    employeeName:     user.employeeName || username || 'Unknown',
                    pickLocations:    pickedLocationsRef.current,
                    itemSku:          backfillItems[0].gamacode,
                    orderedQty:       backfillItems[0].orderedQty,
                    scannedQty:       pickedLocationsRef.current.reduce((sum, loc) => sum + (loc.qty ?? 0), 0),
                    containerBarcode: backfillItems[0].containerBarcode,
                    httpStatus:       response.status,
                    errorMessage:     ''
                });

                const nextBackfillItem = backfillItems[1]; 
                let isSkipping = false; // Local flag to control immediate state

                if (nextBackfillItem) {
                    const prevLoc = lastVerifiedLocRef.current;
                    const isSameLocation = prevLoc === nextBackfillItem.location || prevLoc === nextBackfillItem.binLocation;
                    
                    if (isSameLocation) {
                        skipLocationScanRef.current = true;
                        isSkipping = true;
                        setScannedLoc(prevLoc); 
                        // DO NOT setAtLocation(false) here, because we want to stay "at location"
                    }
                }

                pickedLocationsRef.current = [];
                dispatch(removeBackfillItem());

                // ONLY reset these if we aren't staying at the same location
                if (!isSkipping) {
                    setAtLocation(false);
                    setScannedLoc("");
                }
                
                // Always reset these item-specific fields
                setScannedQty(0);
                setTote("");
                setFirstScannedLoc("");
                setAlternateLocRequired(false);
                setAwaitingToteOnlyRemoval(false);
                setRequireToteAfterNotHave(false);
                setUnavailableAllLocations(false);
                isUpdatingQty.current = false;
            }
        } catch (err) {
            console.error("Error updating order:", err);

            // ── Log network/exception error ──
            BackfillLogger.logUpdateQty({
                employeeId:       user.employeeID   || 'N/A',
                employeeName:     user.employeeName || username || 'Unknown',
                pickLocations:    pickedLocationsRef.current,
                itemSku:          backfillItems[0]?.gamacode || 'N/A',
                orderedQty:       backfillItems[0]?.orderedQty || 0,
                scannedQty:       pickedLocationsRef.current.reduce((sum, loc) => sum + (loc.qty ?? 0), 0),
                containerBarcode: backfillItems[0]?.containerBarcode || 'N/A',
                httpStatus:       err.response?.status || 0,
                errorMessage:     err.response?.data?.reason || err.message || 'Network error'
            });

            isUpdatingQty.current = false;
        }
    }, [backfillItems, user.employeeID, dispatch]);

    // Called when Not Have is confirmed at the first location.
    // Requires containerBarcode scan before the user can proceed to alternate location.
    const storeFirstLocationAndAdvance = useCallback(({ qty, loc, isSingleLocation }) => {
        console.log("storeFirstLocationAndAdvance — loc:", loc, "qty:", qty, "singleLoc:", isSingleLocation);

        // Always record what was (or wasn't) scanned at this location.
        pickedLocationsRef.current = [{ pickLocation: loc, qty }];

        if (isSingleLocation) {
            // Single-location: nothing left to try — go straight to tote scan.
            // updateQty will be called once the tote is scanned.
            setScannedQty(0);
            setTote("");
            setScannedLoc("");
            setAtLocation(false);
            setAwaitingToteOnlyRemoval(true);
        } else {
            // Two-location: require container barcode scan BEFORE going to alternate,
            // UNLESS no quantity was scanned at this location (nothing went into the tote).
            setFirstScannedLoc(loc);
            setAlternateLocRequired(true);
            setScannedQty(qty);  // carry forward so display shows aggregate total
            setTote("");

            if (qty === 0) {
                // Nothing was scanned here — no container scan needed. Go straight to alternate location.
                setRequireToteAfterNotHave(false);
                setScannedLoc("");
                setAtLocation(false);
            } else {
                // Stay on the at-location screen so the tote input handles the container scan.
                setRequireToteAfterNotHave(true);
                setTimeout(() => {
                    toteRef.current?.focus();
                    playSound(scanContainerSound);
                }, 500);
            }
        }
    }, []);

    const updateBackfill = useCallback(async () => {
        if (backfillCompletedRef.current) return; // ← guard against duplicate calls
        backfillCompletedRef.current = true;
        try {
            const response = await axios.post('http://192.168.2.165/api/Order/updateBackFillCompleted', {
                token: 'Yh2k7QSu4l8CZg5p6X3Pna9L0Miy4D3Bvt0JVr87UcOj69Kqw5R2Nmf4FWs03Hdx',
                employeeId: user.employeeID,
                orders: backfillOrderIdsRef.current
            })

            if (response.data.success) {
                // ── Log successful updateBackFillCompleted ──
                BackfillLogger.logUpdateCompleted({
                    employeeId:   user.employeeID   || 'N/A',
                    employeeName: user.employeeName || username || 'Unknown',
                    httpStatus:   response.status,
                    errorMessage: ''
                });

                setBfModalVisible(true);
                setErrorMsg("Backfill Completed");
                playSound(backfillDoneSound);
                lastVerifiedLocRef.current = '';
            } else {
                // ── Log failed updateBackFillCompleted ──
                BackfillLogger.logUpdateCompleted({
                    employeeId:   user.employeeID   || 'N/A',
                    employeeName: user.employeeName || username || 'Unknown',
                    httpStatus:   response.status,
                    errorMessage: response.data.reason || 'Request failed'
                });

                backfillCompletedRef.current = false; // reset on failure so it can retry
            }
        } catch (err) {
            console.log("backfill update error: ", err.message);

            // ── Log network/exception error ──
            BackfillLogger.logUpdateCompleted({
                employeeId:   user.employeeID   || 'N/A',
                employeeName: user.employeeName || username || 'Unknown',
                httpStatus:   err.response?.status || 0,
                errorMessage: err.response?.data?.reason || err.message || 'Network error'
            });

            backfillCompletedRef.current = false; // reset on error so it can retry
        }
    }, [])

    const handleEditIconPress = async () => {
        console.log("handleEditIconPress called");
        console.log("showKeyboard:", showKeyboard);
        
        // Just toggle keyboard, validation happens in real-time now
        setShowKeyboard(!showKeyboard);    

        scanLocRef.current?.focus();
    }

    const showToast = (message) => {
        if (Platform.OS === 'android') {
        ToastAndroid.show(message, ToastAndroid.SHORT);
        } else {
        // For iOS, you can use Alert or a third-party toast library
        Alert.alert('Keyboard Status', message);
        }
    }

    return (
        <SafeAreaView>
            <Modal
                animationType="fade"
                transparent={true}
                visible={itemDescriptionVisible}
                onRequestClose={() => setItemDescriptionVisible(false)}
                >
                <TouchableOpacity 
                    style={{
                        flex: 1,
                        backgroundColor: 'rgba(0,0,0,0.5)',
                        justifyContent: 'center',
                        alignItems: 'center'
                    }}
                    activeOpacity={1}
                    onPress={() => setItemDescriptionVisible(false)}
                >
                    <View style={{
                        backgroundColor: 'white',
                        borderRadius: 15,
                        padding: 20,
                        width: '80%',
                        maxHeight: '70%'
                    }}>
                        <Text style={{
                            fontSize: 24,
                            fontWeight: 'bold',
                            marginBottom: 10,
                            textAlign: 'center'
                        }}>Item Description</Text>
                        <Text style={{
                            fontSize: 20,
                            textAlign: 'center',
                            marginBottom: 10
                        }}>{itemName}</Text>
                        <Text
                            style={{
                                // backgroundColor: "#00d0f0ff",
                                // paddingHorizontal: 20,
                                // paddingVertical: 10,
                                textAlign: "center",
                                fontSize: 20,
                                fontWeight: 'bold',
                                borderRadius: 5,
                                alignSelf: 'center',
                                marginBottom: 10
                            }}>
                            SKU: {orderedItem}
                        </Text>
                        <TouchableOpacity 
                            style={{
                                backgroundColor: "rgb(0, 85, 165)",
                                paddingHorizontal: 30,
                                paddingVertical: 15,
                                borderRadius: 10,
                                alignSelf: 'center'
                            }}
                            onPress={() => setItemDescriptionVisible(false)}
                        >
                            <Text style={{color: 'white', fontSize: 20}}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>
            <Modal
                animationType="slide"
                transparent={true}
                visible={logoutVisible}>
                <TouchableOpacity
                    style={{
                        backgroundColor: 'black',
                        position: 'absolute',
                        padding: 15,
                        borderRadius: 15
                    }}
                    onPress={() => {
                        setLogoutVisible(false);
                    }}
                    >
                    <Text style={{ color: 'white', fontSize: 30}}>X</Text>
                </TouchableOpacity>
                <View style={styles.centeredView}>
                    <View style={{...styles.modalView, width: 500, padding: 0, flexWrap: 'wrap', flexDirection: 'row'}}>
                        <TouchableOpacity 
                            style={{width: '50%', borderColor: 'black', borderWidth: 2, borderEndWidth: 1, padding: 50}}
                            onPress={() => {
                                handleLogout();
                            }}>
                            <Text style={{...styles.modalText, fontSize: 30}}>Lunch</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                            style={{width: '50%', borderColor: 'black', borderWidth: 2, borderTopWidth: 2, borderBottomWidth: 1, padding: 50}}
                            onPress={() => {
                                handleLogout();
                            }}>
                            <Text style={{...styles.modalText, fontSize: 30}}>Break</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                            style={{width: '50%', borderColor: 'black', borderWidth: 2, borderEndWidth: 1, borderBottomWidth: 2, padding: 50}}
                            onPress={() => {
                                handleLogout();
                            }}>
                            <Text style={{...styles.modalText, fontSize: 30}}>Bathroom</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                            style={{width: '50%', borderColor: 'black', borderWidth: 2, padding: 50}}
                            onPress={() => {
                                handleLogout();
                            }}>
                            <Text style={{...styles.modalText, fontSize: 30}}>Clean</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
            <Modal
            animationType="slide"
            transparent={true}
            visible={notHaveVisible}>
                <View style={styles.centeredView}>
                    <View style={{...styles.modalView, width: 500}}>
                        <Text style={styles.modalText}>Are you sure the item isn't available?</Text>
                        <View style={{flexDirection: 'row', justifyContent: 'space-around'}}>
                            <TouchableOpacity 
                                style={{...styles.rectButton, justifyContent: 'center'}}
                                onPress={() => {
                                    if (backfillItems.length > 0 && (scannedQty !== backfillItems[0].orderedQty)) {
                                        const item = backfillItems[0];
                                        const hasBothLocations = item.location && item.location.length > 0
                                            && item.binLocation && item.binLocation.length > 0;

                                        if (hasBothLocations && !alternateLocRequired) {
                                            // First Not Have on a two-location item — store this location's
                                            // entry locally and send the user to the alternate location.
                                            // No API call yet.
                                            storeFirstLocationAndAdvance({
                                                qty: scannedQty,
                                                loc: scannedLoc,
                                                isSingleLocation: false
                                            });
                                        } else {
                                            // Second Not Have (alternate location exhausted) OR
                                            // single-location item — require container barcode scan before updateQty,
                                            // UNLESS nothing was scanned at this location (nothing went into the tote).
                                            const prevQty = pickedLocationsRef.current[0]?.qty ?? 0;
                                            const addedAtThisLoc = scannedQty - prevQty;

                                            pickedLocationsRef.current = [
                                                ...pickedLocationsRef.current,
                                                { pickLocation: scannedLoc, qty: addedAtThisLoc }
                                            ];

                                            if (addedAtThisLoc === 0) {
                                                // Nothing was scanned at this location — skip container scan and finalize directly.
                                                console.log("Not Have at alternate with 0 qty — skipping container scan, calling updateQty");
                                                updateQty();
                                            } else {
                                                // Set flag to require tote/containerBarcode scan before finalizing.
                                                // Stay on the at-location screen so the tote input handles the scan.
                                                setRequireToteAfterNotHave(true);
                                                setTote("");
                                                setTimeout(() => {
                                                    toteRef.current?.focus();
                                                    playSound(scanContainerSound);
                                                }, 500);
                                            }
                                        }
                                    }
                                    setNotHaveVisible(false);
                                }}
                                >
                                <Text
                                    style={{textAlign: 'center'}}
                                >Yes</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={{...styles.rectButton, justifyContent: 'center', marginStart: 40}}
                                onPress={() => {
                                    dispatch(removeBackfillItem());
                                    setNotHaveVisible(false);
                                }}>
                                <Text style={{textAlign: 'center'}}>No</Text>
                            </TouchableOpacity>
                            {/*
                                Third option: "Unavailable All Locations".
                                Only shown at the FIRST location of a two-location item
                                (i.e. before the user has Not Have'd once and been sent to the alternate).
                                For single-location items, the existing Yes already means
                                "unavailable everywhere", so the button adds nothing there.
                            */}
                            {(() => {
                                if (backfillItems.length === 0) return null;
                                if (alternateLocRequired) return null; // already at alternate — hide
                                const item = backfillItems[0];
                                const hasBothLocations = item.location && item.location.length > 0
                                    && item.binLocation && item.binLocation.length > 0;
                                if (!hasBothLocations) return null; // single-location item — hide

                                return (
                                    <TouchableOpacity
                                        style={{...styles.rectButton, justifyContent: 'center', marginStart: 40}}
                                        onPress={() => {
                                            // User is telling us the item isn't available at EITHER location.
                                            // Do NOT send them to the alternate. Finalize this item now.
                                            // Record only what (if anything) was scanned at this location.
                                            pickedLocationsRef.current = [
                                                { pickLocation: scannedLoc, qty: scannedQty }
                                            ];
                                            setUnavailableAllLocations(true);

                                            if (scannedQty > 0) {
                                                // Qty was scanned — require containerBarcode scan before updateQty.
                                                // The tote useEffect will fire updateQty once the correct tote is scanned.
                                                setRequireToteAfterNotHave(true);
                                                setTote("");
                                                setTimeout(() => {
                                                    toteRef.current?.focus();
                                                    playSound(scanContainerSound);
                                                }, 500);
                                            } else {
                                                // Nothing scanned — no tote needed. Finalize directly with a zero-qty entry.
                                                updateQty();
                                            }

                                            setNotHaveVisible(false);
                                        }}>
                                        <Text style={{textAlign: 'center'}}>No Locations Available</Text>
                                    </TouchableOpacity>
                                );
                            })()}
                        </View>
                    </View>
                </View>
            </Modal>
            <Modal
            animationType="slide"
            transparent={true}
            visible={modalVisible || bfModalVisible}
            onRequestClose={() => {
                setErrorMsg("");
                setScannedLoc("");
                setTote("");
                setModalVisible(false);
                setBfModalVisible(false);
                if (backfillItems.length === 0) {
                    setBackfillCompleted(true);
                }
            }}
            >
                <View style={styles.centeredView}>
                    <View style={styles.modalView}>
                        <Text style={styles.modalText}>{errorMsg}</Text>
                        <TouchableOpacity style={{...styles.button, marginTop: '20', backgroundColor: "rgb(0, 85, 165)", paddingHorizontal: 20}}
                        onPress={() => {
                            setModalVisible(false);
                            setBfModalVisible(false);
                            setErrorMsg("");
                            if (backfillItems.length === 0) {
                                setBackfillCompleted(true);
                            }
                        }}>
                            <Text style={{color: 'white', fontSize: 20}}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
            <Modal
            animationType="slide"
            transparent={true}
            visible={picksStarted && isReturning && verifiedOrders.length !== backfillOrderIds.length}>
                <View style={styles.centeredView}>
                    <View style={styles.modalView}>
                        <Text style={styles.modalText}>Verify Order {requiredOrders[0]}</Text>
                        <TextInput 
                            style={{...styles.inputField, borderColor: 'black', borderWidth: 1, width: 150}}
                            placeholder='Scan order'
                            autoFocus={true}
                            showSoftInputOnFocus={false}
                            onChangeText={async (newVal) => {
                                setVerifyOrderVal(newVal);
                                if (newVal.slice(0, 6) === requiredOrders[0].slice(0,6)) {
                                    // setVerifyOrder(true);
                                    setRequiredOrders(prevOrders => prevOrders.slice(1));
                                    dispatch(addVerifiedOrder(newVal));
                                    setVerifyOrderVal("");
                                } else {
                                    setErrorMsg(`Incorrect Order`);
                                    playSound(buzzer);
                                    if (!backfillCompletedRef.current) setModalVisible(true);
                                    setVerifyOrderVal("");
                                    // setTimeout(() => {
                                    //     setModalVisible(false);
                                    // }, 2000)
                                }
                            }}
                            value={verifyOrderVal}
                        />
                    </View>
                </View>
            </Modal>
            {(user.employeeName !== ''  && (!atLocation && backfillItems.length > 0 && !orderComplete)) &&
                    <SafeAreaView style={{
                        width: '95%'
                    }}>
                        <View style={{
                            flexDirection: "row",
                            justifyContent: "space-around",
                            flexWrap: "wrap",
                            marginTop: 10
                        }}>
                            <View style={{
                                marginStart: 0,
                                // marginTop: 50,
                                flex: 1,
                                flexDirection: 'row',
                            }}>
                                <View style={{
                                    backgroundColor: "#f1fe01ff", 
                                    borderTopEndRadius: 10, 
                                    borderTopStartRadius: 10, 
                                    borderBottomEndRadius: 10, 
                                    borderBottomStartRadius: 10,
                                    width: 200,
                                    minHeight: 120,
                                    display: 'flex',
                                    justifyContent: 'center',
                                    alignSelf: 'center'
                                }}>
                                    {/* <Text style={{margin: 0, lineHeight: 20, paddingTop: 10, paddingStart: 5, fontWeight: 'bold', fontSize: 20}}>Location: </Text> */}
                                    <Text
                                    style={{
                                        margin: 0,
                                        lineHeight: 10,
                                        paddingBottom: 20,
                                        textAlign: "center",
                                        fontSize: 25,
                                        fontWeight: 'bold'
                                        }}>
                                    {`\n`}{orderedLocs[0]}
                                    </Text>
                                    <Text
                                    style={{
                                        paddingTop: 20,
                                        lineHeight: 10,
                                        paddingBottom: 10,
                                        borderTopWidth: 3,
                                        textAlign: "center",
                                        fontSize: 25,
                                        fontWeight: 'bold'
                                        }}>{orderedLocs[1]}
                                    </Text>
                                </View>
                                <TouchableOpacity
                                    onPress={() => setItemDescriptionVisible(true)}
                                    activeOpacity={0.7}
                                    style={{
                                        flexDirection: 'column',
                                        justifyContent: 'flex-start',
                                        alignItems: 'center',
                                        width: 300,
                                        backgroundColor: '#fff',
                                        borderTopEndRadius: 10, 
                                        borderTopStartRadius: 10, 
                                        borderBottomEndRadius: 10, 
                                        borderBottomStartRadius: 10,
                                        paddingTop: 10, 
                                        paddingBottom: 10,
                                        minHeight: 120
                                    }}
                                >
                                    <View style={{
                                        width: '100%',
                                        paddingHorizontal: 10,
                                        marginBottom: 10
                                    }}>
                                        <Text 
                                            style={{
                                                fontSize: 20, 
                                                width: "100%", 
                                                textAlign: "center", 
                                                fontWeight: 'bold'
                                            }}
                                            numberOfLines={2}
                                            ellipsizeMode="tail"
                                        >
                                            {itemName}
                                        </Text>
                                    </View>
                                    <Text
                                        style={{
                                            backgroundColor: "#00d0f0ff",
                                            paddingHorizontal: 20,
                                            textAlign: "center",
                                            fontSize: 20,
                                            fontWeight: 'bold'
                                            }}>
                                        SKU: {orderedItem}
                                    </Text>
                                    <Text style={{
                                        width: 150,
                                        fontSize: 20,
                                        textAlign: 'center'
                                    }}>Ordered QTY: {backfillItems && backfillItems[0].orderedQty}</Text>
                                    {alternateLocRequired && (
                                        <Text style={{
                                            width: 150,
                                            fontSize: 14,
                                            textAlign: 'center',
                                            color: '#d61a1a',
                                            fontWeight: 'bold',
                                            marginTop: 4
                                        }}>{requireToteAfterNotHave ? 'Scan container barcode' : 'Scan alternate location'}</Text>
                                    )}
                                    {awaitingToteOnlyRemoval && (
                                        <Text style={{
                                            width: 180,
                                            fontSize: 14,
                                            textAlign: 'center',
                                            color: '#d61a1a',
                                            fontWeight: 'bold',
                                            marginTop: 4
                                        }}>Scan tote to continue</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>
                        <Text style={{...styles.heading, marginTop: 10, fontWeight: 'bold', marginLeft: 60}}>
                            {awaitingToteOnlyRemoval ? 'Scan Tote' : (requireToteAfterNotHave ? 'Scan Container' : 'Scan Location')}
                        </Text>
                        <View style={{flexDirection: 'row', width: 400, marginHorizontal: 'auto'}}>
                            <TouchableOpacity
                                style={styles.clearButton}
                                onPress={() => {
                                    setScannedLoc("");
                                }}>
                                <Text style={styles.clearButtonText}>Clear</Text>
                            </TouchableOpacity>
                            {awaitingToteOnlyRemoval || requireToteAfterNotHave ? (
                                // Require containerBarcode scan (after first Not Have) or tote scan (single-location)
                                <TextInput
                                    style={{...styles.inputField, width: 200, marginHorizontal: "auto", borderColor: "black", borderWidth: 1}}
                                    autoFocus={true}
                                    showSoftInputOnFocus={false}
                                    onChangeText={(newVal) => {
                                        console.log("Container/Tote input - newVal:", newVal, "requireToteAfterNotHave:", requireToteAfterNotHave);
                                        
                                        if (requireToteAfterNotHave) {
                                            // Validate containerBarcode after Not Have (safety net — primary path is at-location tote input)
                                            if (newVal === backfillItems[0].containerBarcode) {
                                                playSound(scanContainerSound);
                                                setTote("");

                                                if (pickedLocationsRef.current.length >= 2 || unavailableAllLocations) {
                                                    // Second Not Have OR Unavailable All Locations — finalize
                                                    console.log("Finalizing Not Have container scan (non-atLocation) — calling updateQty");
                                                    updateQty();
                                                } else {
                                                    // First Not Have — clear flag, advance to alternate location
                                                    console.log("First Not Have container scan (non-atLocation) — advancing to alternate location");
                                                    setRequireToteAfterNotHave(false);
                                                    setScannedLoc("");
                                                }
                                            } else if (newVal.length >= 4) {
                                                console.log("INCORRECT CONTAINER BARCODE");
                                                playSound(scanContainerFail);
                                                setErrorMsg(`Wrong Container \nExpected: ${backfillItems[0].containerBarcode}\nScanned: ${newVal}`);
                                                setModalVisible(true);
                                                setTote("");
                                            } else {
                                                setTote(newVal);
                                            }
                                        } else if (awaitingToteOnlyRemoval) {
                                            // For single-location items, validate location scan (old behavior)
                                            const acceptableLocs = [backfillItems[0].location, backfillItems[0].binLocation];
                                            
                                            if (showKeyboard === false && acceptableLocs.includes(newVal)) {
                                                lastVerifiedLocRef.current = newVal;
                                                setScannedLoc(newVal);
                                                setSno(backfillItems[0].sNo);
                                                setAtLocation(true);
                                            } else if (showKeyboard === false && newVal.length >= 4 && !acceptableLocs.includes(newVal)) {
                                                playSound(wrongLocation);
                                                setErrorMsg(`Incorrect Location: ${newVal}`);
                                                setModalVisible(true);
                                                setScannedLoc("");
                                            } else {
                                                setScannedLoc(newVal);
                                            }
                                        }
                                    }}
                                    autoCapitalize='characters'
                                    value={tote}
                                />
                            ) : (
                                <TextInput
                                style={{...styles.inputField, width: 200, marginHorizontal: "auto", borderColor: "black", borderWidth: 1}}
                                ref={scanLocRef}
                                onChangeText={async (newVal) => {
                                    console.log("onChangeText called - newVal:", newVal, "showKeyboard:", showKeyboard);

                                    // Determine which location(s) are acceptable this pass.
                                    // If alternateLocRequired, only the location the user has NOT yet scanned is valid.
                                    const acceptableLocs = alternateLocRequired
                                        ? orderedLocs.filter(l => l && l.length > 0 && l !== firstScannedLoc)
                                        : orderedLocs.filter(l => l && l.length > 0);

                                    const longestAcceptable = acceptableLocs.reduce(
                                        (max, l) => Math.max(max, l.length), 0
                                    );

                                    // Store value in ref for keyboard validation
                                    if (showKeyboard === true) {
                                        scannedLocValueRef.current = newVal;
                                        setScannedLoc(newVal);
                                        // Validate keyboard input when it reaches expected length
                                        if (acceptableLocs.includes(newVal) && newVal.length >= longestAcceptable) {
                                            console.log("Setting scannedLoc (keyboard enabled):", newVal);
                                            lastVerifiedLocRef.current = newVal;
                                            setSno(backfillItems[0].sNo);
                                            setAtLocation(true);
                                        }
                                    }

                                    if (showKeyboard === false && !acceptableLocs.includes(newVal) 
                                        // && newVal.length >= longestAcceptable
                                    ) {
                                        // Scanned something that isn't acceptable for this pass
                                        const errDetail = alternateLocRequired
                                            ? `Must scan alternate location`
                                            : `Incorrect Location \n ${newVal}`;
                                        setErrorMsg(errDetail);
                                        playSound(wrongLocation);
                                        setModalVisible(true);
                                    } else if (showKeyboard === false && acceptableLocs.includes(newVal)) {
                                        // Correct location scanned
                                        console.log("Setting scannedLoc (correct scan):", newVal);
                                        lastVerifiedLocRef.current = newVal;
                                        setScannedLoc(newVal);
                                        setSno(backfillItems[0].sNo);
                                        setAtLocation(true);
                                    }
                                }}
                                // onBlur={async () => {
                                //     console.log("onBlur called - scannedLoc:", scannedLoc, "orderedLocs:", orderedLocs);
                                //     // Validate when field loses focus (keyboard entry complete)
                                //     if (showKeyboard && !orderedLocs.at(scannedLoc) && (newVal.length >= orderedLocs[0].length || newVal.length >= orderedLocs[1].length)) {
                                //         console.log("LOGGING BAD SCAN - keyboard onBlur");
                                //         // await BadScanLogger.logBadScan({
                                //         //     employeeId: user.employeeID || 'N/A',
                                //         //     employeeName: user.employeeName || username || 'Unknown',
                                //         //     scanType: 'Location',
                                //         //     expected: orderedLocs,
                                //         //     scanned: scannedLoc
                                //         // });
                                        
                                //         setErrorMsg(`Incorrect Location \n ${scannedLoc}`);
                                //         playSound(wrongLocation);
                                //         if (!backfillCompletedRef.current) setModalVisible(true);
                                //     }
                                // }}
                                autoFocus={true}
                                autoCapitalize='characters'
                                showSoftInputOnFocus={showKeyboard}
                                value={scannedLoc}
                            />
                            )}{/* closes container/tote input ternary */}
                            {!awaitingToteOnlyRemoval && !requireToteAfterNotHave && <TouchableOpacity onPress={() => {
                                handleEditIconPress();
                            }}>
                                <Image 
                                    style={{
                                        width: 50, 
                                        height: 50,
                                        marginTop: 15
                                    }}
                                    source={editIcon}
                                />
                            </TouchableOpacity>}
                        </View>
                    </SafeAreaView>
                 }

                 {(username !== '' && backfillItems.length > 0 && atLocation 
                && !orderComplete) && <SafeAreaView style={styles.scanContainer}>
                <View style={{
                    display: 'flex',
                    height: 50,
                    alignItems: 'center',
                    width: '95%'
                    }}>
                    <View
                        style={{
                            flexDirection: 'row'}}>
                        <View style={{
                            width: '65%',
                            marginEnd: 'auto'
                        }}>
                            <View style={{display: 'flex', backgroundColor: "#f1fe01ff", borderTopEndRadius: 10, borderTopStartRadius: 10, borderBottomEndRadius: 10, borderBottomStartRadius: 10}}>
                                <Text style={{margin: 0, lineHeight: 20, paddingTop: 10, paddingStart: 5, fontWeight: 'bold', fontSize: 20}}>Location: </Text>
                                <Text
                                style={{
                                    margin: 0,
                                    lineHeight: 15,
                                    paddingBottom: 5,
                                    textAlign: "center",
                                    fontSize: 30,
                                    fontWeight: 'bold'
                                    }}>
                                {`\n`}{orderedLocs[0]}
                                </Text>
                                <Text
                                style={{
                                    margin: 0,
                                    lineHeight: 15,
                                    paddingBottom: 20,
                                    textAlign: "center",
                                    fontSize: 30,
                                    fontWeight: 'bold'
                                    }}>
                                {`\n`}{orderedLocs[1]}
                                </Text>
                            </View>
                        <View 
                            style={{
                                flexDirection: 'column',
                                justifyContent: 'space-around',
                                alignItems: 'center',
                                width: '100%',
                                backgroundColor: '#fff',
                                borderTopEndRadius: 10, borderTopStartRadius: 10, borderBottomEndRadius: 10, borderBottomStartRadius: 10,
                                // marginTop: 10,
                                paddingTop: 2, paddingBottom: 10
                                }}>
                            <Text style={{fontSize: 20, width: "85%", textAlign: "center", marginBottom: 10, fontWeight: 'bold'}}>
                                {backfillItems[0].description}
                            </Text>
                            <Text
                                style={{
                                    backgroundColor: "#00d0f0ff",
                                    paddingHorizontal: 20,
                                    textAlign: "center",
                                    fontSize: 20,
                                    fontWeight: 'bold'
                                    }}>
                                SKU: {backfillItems[0].gamacode}
                            </Text>
                        </View>
                        </View>
                        <View
                        style={{
                            flexDirection: 'column',
                            alignItems: 'center',
                            marginStart: 10
                        }}>
                            <View>
                                <Text style={{ fontSize: 25, fontWeight: 'bold', textAlign: 'center', lineHeight: 30}}>ORDER:</Text>
                                <Text style={{ fontSize: 30, fontWeight: 'bold'}}>{backfillItems[0].orderId}</Text>
                            </View>
                            <View
                                style={{
                                    backgroundColor: '#fff',
                                    paddingBottom: 10, paddingHorizontal: 10,
                                    borderTopEndRadius: 10, borderTopStartRadius: 10, borderBottomEndRadius: 10, borderBottomStartRadius: 10
                                }}
                            >
                                <Text
                                    style={{fontSize: 25, fontWeight: 'bold', textAlign: 'center'}}>
                                        Tote:
                                </Text>
                                <TextInput 
                                    ref={toteRef}
                                    style={{ ...styles.inputField, marginHorizontal: 'auto', marginBottom: 0, width: 140, borderColor: 'black', borderWidth: 2}}
                                    // autoFocus={true}
                                    editable={scannedQty !== orderedQty ? true : false}
                                    showSoftInputOnFocus={false}
                                    onChangeText={async (newVal) => {
                                        console.log("Tote onChangeText - newVal:", newVal, "requireToteAfterNotHave:", requireToteAfterNotHave);
                                        console.log("EMPLOYEE:", user.badgeId);
                                        
                                        // If requireToteAfterNotHave is true, validate the containerBarcode
                                        if (requireToteAfterNotHave) {
                                            if (newVal === backfillItems[0].containerBarcode) {
                                                // CORRECT: Handle first vs second Not Have
                                                console.log("CORRECT CONTAINER BARCODE");
                                                setTote("");
                                                
                                                // Check if this is first or second Not Have by checking pickedLocationsRef length,
                                                // OR if the user tapped "Unavailable All Locations" (which finalizes immediately).
                                                if (pickedLocationsRef.current.length === 2 || unavailableAllLocations) {
                                                    // SECOND Not Have or UNAVAILABLE ALL LOCATIONS — finalize with updateQty.
                                                    // Don't play scanContainerSound — updateQty sets atLocation(false)
                                                    // which triggers the atLocation useEffect playing nextItem.
                                                    console.log("Finalizing after Not Have - calling updateQty");
                                                    updateQty();
                                                } else {
                                                    // FIRST Not Have - container scanned, now advance to alternate location
                                                    // Don't play scanContainerSound here — setAtLocation(false) triggers
                                                    // the atLocation useEffect which plays nextItem for the new location.
                                                    console.log("First Not Have - container scanned, advancing to alternate location");
                                                    setRequireToteAfterNotHave(false);
                                                    setTote("");
                                                    setScannedLoc("");
                                                    setAtLocation(false);
                                                }
                                            } else if (newVal.length >= 4) {
                                                // INCORRECT: Show error
                                                console.log("INCORRECT CONTAINER BARCODE");
                                                playSound(scanContainerFail);
                                                setErrorMsg(`Wrong Container \nExpected: ${backfillItems[0].containerBarcode}\nScanned: ${newVal}`);
                                                setModalVisible(true);
                                                setTote("");
                                            } else {
                                                // Still typing
                                                setTote(newVal);
                                            }
                                        } else if (locations.includes(newVal) || upcs.includes(newVal) || skus.includes(newVal) || aliasLists.includes(newVal) || itemMultipliers.includes(newVal) || newVal.startsWith("TA")) {
                                            console.log("BAD TOTE DETECTED in onChangeText");
                                            // Log the bad tote scan (scanned location/item instead of tote)
                                            // await BadScanLogger.logBadScan({
                                            //     employeeId: user.employeeID || 'N/A',
                                            //     employeeName: user.employeeName || username || 'Unknown',
                                            //     scanType: 'Tote',
                                            //     expected: 'N/A',
                                            //     scanned: newVal
                                            // });
                                            setErrorMsg(`Wrong Barcode \n ${newVal}`);
                                            // playSound(scanContainerFail);
                                            setModalVisible(true);
                                            setTote("");
                                            // setTimeout(() => {
                                            //     setModalVisible(false);
                                            //     setErrorMsg("");
                                            // }, 2000)
                                        } else {
                                            console.log("VALID TOTE in onChangeText - focusing item field");
                                            setTote(newVal);
                                            
                                            // let containerObj = {
                                            //     containerBarcode: newVal,
                                            //     qty: lastQty
                                            // }
                                            // setContainers(prevContainers => [...prevContainers, containerObj]);
                                            // dispatch(addContainer(containerObj));
                                            setTimeout(() => {
                                                console.log("Attempting to focus itemRef");
                                                // itemRef.current?.focus();
                                            },   500)
                                        }

                                        if (!requireToteAfterNotHave && newVal !== backfillItems[0].containerBarcode && newVal.length > 0) {
                                            playSound(scanContainerFail);
                                        }
                                    }}
                                    onFocus={() => {
                                        if (tote.length > 0) {
                                            // setTimeout(() => {
                                            //     itemRef.current?.focus();
                                            // }, 500)
                                        }
                                    }}
                                    value={tote}
                                />
                                <TouchableOpacity
                                    onPress={() => {
                                        // if (containers.length > 0 && containers[containers.length - 1].qty === 0) {
                                        //     dispatch(removeLastContainer()); // or whatever your Redux action is
                                        // }
                                        // setTote("");
                                        // setTimeout(() => {
                                        //     toteRef.current?.focus();
                                        // }, 500)
                                    }}>
                                    {/* <Text
                                        style={{...styles.rectButton, backgroundColor: "rgb(0, 85, 165)", color: 'white', marginTop: 10, fontSize: 20, fontWeight: 'bold', height: 55, borderColor: 'black', borderWidth: 1}}>
                                            Next Container
                                    </Text> */}
                                </TouchableOpacity>
                                <Text
                                    style={{fontSize: 25, fontWeight: 'bold', textAlign: 'center'}}>
                                        {backfillItems[0].containerBarcode}
                                </Text>
                            </View>
                        </View>
                    </View>
                    <View style={{
                        flexDirection: 'row',
                        justifyContent: 'space-around',
                        // marginEnd: 'auto',
                        marginEnd: 300,
                        width: '65%'
                    }}>
                        <TouchableOpacity 
                            style={{...styles.rectButton, backgroundColor: "rgb(0, 85, 165)", width: 75, justifyContent: 'center', verticalAlign: 'middle', alignSelf: 'flex-end', height: 62, borderColor: 'black', borderWidth: 1}}
                            onPress={() => {
                                setNotHaveVisible(true)
                        }}>
                            <Text style={{color: 'white', textAlign: 'center', fontSize: 25, fontWeight: 'bold', lineHeight: 25}}>Not Have</Text>
                        </TouchableOpacity>
                        <View style={{
                            flexDirection: 'row',
                            justifyContent: 'space-around',
                            width: '95%',
                            height: 65,
                            backgroundColor: '#fff',
                            paddingBottom: 10, paddingTop: 20,
                            marginStart: 10, marginTop: 20,
                            borderTopEndRadius: 10, borderTopStartRadius: 10, borderBottomEndRadius: 10, borderBottomStartRadius: 10
                        }}>
                            <View style={{
                                alignSelf: 'flex-end',
                                alignContent: 'center'
                            }}>
                                <Text style={{
                                    fontSize: 30,
                                    alignSelf: 'flex-end',
                                    fontWeight: 'bold',
                                    textAlign: 'center',
                                    width: 60,
                                    lineHeight: 25
                                    }}>
                                    {backfillItems.length > 0 && backfillItems[0].orderedQty}
                                </Text>
                                <Text
                                    style={{
                                        fontWeight: 'bold'
                                    }}
                                >ORDERED</Text>
                            </View>
                            <View style={{
                                alignSelf: 'flex-end'
                            }}>
                                {sending && <Image 
                                        style={{ width: 100, height: 100, position: 'absolute', left: '40%', top: '40%'}}
                                        source={loadingAnim}/>}
                                <Text style={{fontWeight: 'bold', textAlign: 'center'}}>
                                    SKU TO PICK
                                </Text>
                                <TextInput 
                                    style={{ ...styles.inputField, width: 150, borderColor: 'black', borderWidth: 2}}
                                    ref={itemRef}
                                    autoFocus={true}
                                    showSoftInputOnFocus={false}
                                    // editable={toteScanned && scannedQty !== orderedQty ? true : false}
                                    onChangeText={(newVal) => {
                                        setScannedItem(newVal);

                                        const aliasFound = backfillItems[0].upcAliasList && backfillItems[0].upcAliasList.some(obj => obj["upc"] === newVal);
                                        console.log("aliasFound: ", aliasFound);
                                        let multiplierIndex = false;

                                        if (backfillItems[0].upcList === null) {
                                            multiplierIndex = false;
                                        } else {
                                            multiplierIndex = backfillItems[0].upcList && backfillItems[0].upcList.findIndex(obj => obj.upc === newVal);
                                        }

                                        let multiplierFound = false;
                                        if (multiplierIndex > -1 && multiplierIndex !== null && multiplierIndex !== false) {
                                            if (backfillItems && backfillItems[0].upcList[multiplierIndex].sellingUnitMultiplier <= backfillItems[0].orderedQty) {
                                                multiplierFound = backfillItems[0].upcList && backfillItems[0].upcList.some(obj => obj["upc"] === newVal);
                                            }
                                        }

                                        function updateContainer (qty) {
                                            setScannedQty(prevQty => prevQty + qty);
                                            setTotalItemsScanned(prevItems => prevItems + 1);
                                            // setContainers(prevContainers => {
                                            //     const newContainers = [...prevContainers];

                                            //     const last = newContainers[newContainers.length -1];
                                            //     newContainers[newContainers.length - 1] = {
                                            //         ...last,
                                            //         qty: last.qty + qty
                                            //     };
                                            //     setLastQty(0);
                                            //     return newContainers;
                                            // });
                                            dispatch(updateLastContainerQty(qty));
                                            setLastQty(0);
                                            setTimeout(() => {
                                                setScannedItem("");
                                            }, 500)
                                        }

                                       if (newVal === backfillItems[0].gamacode || newVal === backfillItems[0].itemLookupCode || aliasFound) {
                                            setScannedQty(prevQty => Math.min(prevQty + 1, backfillItems[0].orderedQty));
                                        } else if (backfillItems && multiplierFound) {
                                            setScannedQty(prevQty => Math.min(
                                                prevQty + backfillItems[0].upcList[multiplierIndex].sellingUnitMultiplier,
                                                backfillItems[0].orderedQty
                                            ));
                                        } else {
                                            // Log the bad item scan
                                            // BadScanLogger.logBadScan({
                                            //     employeeId: user.employeeID || 'N/A',
                                            //     employeeName: user.employeeName || username || 'Unknown',
                                            //     scanType: 'Item',
                                            //     expected: order[0].itemLookupCode || order[0].gamacode || 'N/A',
                                            //     scanned: newVal
                                            // });
                                            
                                            setErrorMsg(`Wrong Item \n ${newVal}`);
                                            setScannedItem("");
                                            playSound(wrongItem);
                                            if (!backfillCompletedRef.current) setModalVisible(true);
                                            // setTimeout(() => {
                                            //     setModalVisible(false);
                                            //     setErrorMsg("");
                                            //     setScannedItem("");
                                            // }, 2000)
                                        }
                                    }}
                                    value={scannedItem}
                                />
                            </View>
                        <View style={{
                                alignSelf: 'flex-end',
                                alignContent: 'center'
                            }}>
                                <Text style={{
                                    // display: 'flex',
                                    fontSize: 30,
                                    alignSelf: 'flex-end',
                                    fontWeight: 'bold',
                                    textAlign: 'center',
                                    width: 50,
                                    lineHeight: 25
                                    }}>
                                    {scannedQty}
                                </Text>
                                <Text
                                    style={{
                                        fontWeight: 'bold'
                                    }}
                                >PICKED</Text>
                            </View>
                        </View>
                    </View>
                </View>            
            </SafeAreaView>}
            <TouchableOpacity
                style={{
                    position: 'absolute',
                    top: 25,
                    right: 0,
                    // backgroundColor: '#d61a1a',
                    paddingHorizontal: 15,
                    paddingVertical: 10
                }}
                onPress={() => {
                    setLogoutVisible(true);
                }}
                >
                <Image 
                    style={{width: 50, height: 50}}
                    source={logoutDoor}
                />
                {/* <Text
                    style={{
                        fontSize: 20,
                        color: 'white'
                }}
                >Logout</Text> */}
            </TouchableOpacity>
            {/* Floating log viewer — bottom-left, clear of logout icon */}
            <ParallelLogViewer />
        </SafeAreaView>   
    )
}

export default Backfill;