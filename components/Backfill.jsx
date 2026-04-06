import axios from 'axios';
import { Audio } from 'expo-av';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Modal, NativeModules, Platform, Text, TextInput, ToastAndroid, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { addArrangedBackfillItem, addArrangedBackfillObj, addVerifiedOrder, removeBackfillItem } from '../app/redux/parallelSlice';
import styles from './Backfill.styles';

const Backfill = ({navigation}) => {
    const [atLocation, setAtLocation] = useState(false);
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

    // const [container, setContainers] = useState();
    const [lastQty, setLastQty] = useState(0);
    
    const [errorMsg, setErrorMsg] = useState("");
    const [sending, setSending] = useState(false);
    const [orderComplete, setOrderComplete] = useState(false);
    const [backfillCompleted, setBackfillCompleted] = useState(false);
    const [picksCompleted, setPicksCompleted] = useState(0);

    const [itemDescriptionVisible, setItemDescriptionVisible] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [bfModalVisible, setBfModalVisible] = useState(false);
    const [showKeyboard, setShowKeyboard] = useState(false);
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

    const { AudioRouter } = NativeModules;

    const nextItem = require('../../WarehouseScanner/assets/sounds/next_item.mp3');
    const buzzer = require('../../WarehouseScanner/assets/sounds/buzzer.mp3');
    const scanContainerSound = require('../../WarehouseScanner/assets/sounds/scan_container.mp3');
    const wrongLocation = require('../../WarehouseScanner/assets/sounds/wrong_location.mp3');
    const wrongItem = require('../../WarehouseScanner/assets/sounds/wrong_item.mp3');
    const scanContainerFail = require('../../WarehouseScanner/assets/sounds/did_not_scan_container.mp3');
    const backfillDoneSound = require('../../WarehouseScanner/assets/sounds/backfill_completed.mp3');
    const loadingAnim = require('../../WarehouseScanner/assets/images/loading.webp');
    const editIcon = require('../../WarehouseScanner/assets/images/edit.png');

    useEffect(() => {
        // playSound(nextItem);
        const existingIds = new Set(backfillsArranged.map(obj => obj.orderId));
        const newObjs = orders
        .filter(id => !existingIds.has(id))
        .map(id => ({ orderId: id, order: [] }));

        newObjs.forEach(obj => dispatch(addArrangedBackfillObj(obj)));

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
        console.log("atLocation", backfillItems);
        if (atLocation === false && backfillItems.length > 0) {
            // setLocations([backfillItems[0].location, backfillItems[0].binLocation])
            setOrderedLocs([backfillItems[0].location, backfillItems[0].binLocation])
            setItemName(backfillItems[0].description);
            playSound(nextItem);
        } else {
            // playSound(scanContainerSound);
            itemRef.current?.focus();
            setScannedLoc("");
        }
    }, [atLocation])

    useEffect(() => {
        if (backfillItems.length > 0) {
            setOrderedItem(backfillItems[0].gamacode);
        } else {
            // router.push('./merge');
            updateBackfill();
        }
    }, [backfillItems])

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
            setModalVisible(true);
        }
    }, [orderedItem])

    useEffect(() => {
        setScannedItem("");
        console.log("scannedQty useEffect")
        if (backfillItems.length > 0 && scannedQty === backfillItems[0].orderedQty ) {
            setTimeout(() => {
                toteRef.current?.focus();
                playSound(scanContainerSound);
            }, 500)
        }
    }, [scannedQty])

    useEffect(() => {
        console.log("tote useEffect")
        if (backfillItems.length > 0 && tote === backfillItems[0].containerBarcode && scannedQty === backfillItems[0].orderedQty) {
            console.log("quantity and tote satisfied");
            updateQty();
        }

        if (backfillItems.length > 0 && tote.length > 0 && tote != backfillItems[0].containerBarcode) {
            console.log("TOTE MISMATCH");
            // playSound(scanContainerFail);
            setErrorMsg(`Wrong Tote \n SCAN ${backfillItems[0].containerBarcode}`);
            setModalVisible(true);
            setTote("");
        }
    }, [tote])

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

    const updateQty = useCallback(async () => {
        console.log("UPDATING backfill quantity");
        console.log("employee id: ", user.employeeID);
        console.log("order id: ", backfillItems[0].orderId);
        console.log("item id: ", backfillItems[0].orderBackFillItemsId);
        console.log("location: ", scannedLoc);
        console.log("UPDATEQTY: ", scannedQty);
        try {
            const response = await axios.post('http://192.168.2.165/api/Order/updateBackFillDetails', {
                token: 'Yh2k7QSu4l8CZg5p6X3Pna9L0Miy4D3Bvt0JVr87UcOj69Kqw5R2Nmf4FWs03Hdx',
                employeeId: user.employeeID,
                orderBackFillItemsId: backfillItems[0].orderBackFillItemsId,
                pickLocation: scannedLoc,
                scannedQty: scannedQty,
            });

            if (!response.data.success) {
                setErrorMsg(response.data.reason);
                setModalVisible(true);
                setTimeout(() => {
                    setModalVisible(false);
                    setOrderNum("");
                    setErrorMsg("");
                }, 2000);
            } else {
                for (let i = 0; i < backfillsArranged.length; i++) {
                    console.log("backfills arranged id: ", backfillsArranged[i].orderId);
                    console.log("backfills [0] id: ", backfillItems[0].orderId);
                    if (parseInt(backfillsArranged[i].orderId) == parseInt(backfillItems[0].orderId)) {
                        console.log("backfill Ids match");
                        dispatch(addArrangedBackfillItem(backfillItems[0]));
                    }
                }
                dispatch(removeBackfillItem());
                setAtLocation(false);
                setScannedQty(0);
                setTote("");
            }
        } catch (err) {
            console.error("Error updating order:", err);
        }
    }, [scannedQty, scannedLoc, backfillItems, user.employeeID, dispatch]);

    const updateBackfill = useCallback(async () => {
        try {
            const response = await axios.post('http://192.168.2.165/api/Order/updateBackFillCompleted', {
                token: 'Yh2k7QSu4l8CZg5p6X3Pna9L0Miy4D3Bvt0JVr87UcOj69Kqw5R2Nmf4FWs03Hdx',
                employeeId: user.employeeID,
                orders: backfillOrderIds
            })

            if (response.data.success) {
                setBfModalVisible(true);
                setErrorMsg("Backfill Completed");
                playSound(backfillDoneSound);
            }
        } catch (err) {
            console.log("backfill update error: ", err.message);
        }
    }, [backfillOrderIds])

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
            visible={modalVisible || bfModalVisible}
            onRequestClose={() => {
                setErrorMsg("");
                setScannedLoc("");
                setTote("");
                setModalVisible(false);
                setBfModalVisible(false);
                if (backfillItems.length === 0) {
                    router.push('./merge');
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
                                router.push('./merge');
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
                                    setModalVisible(true);
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
                                </TouchableOpacity>
                            </View>
                        </View>
                        <Text style={{...styles.heading, marginTop: 10, fontWeight: 'bold'}}>Scan Location</Text>
                        <View style={{flexDirection: 'row', width: 300, marginHorizontal: 'auto'}}>
                            <TextInput
                                style={{...styles.inputField, width: 200, marginHorizontal: "auto", borderColor: "black", borderWidth: 1}}
                                useRef={scanLocRef}
                                onChangeText={async (newVal) => {
                                    console.log("onChangeText called - newVal:", newVal, "showKeyboard:", showKeyboard);
                                    
                                    // Store value in ref for keyboard validation
                                    if (showKeyboard === true) {
                                        scannedLocValueRef.current = newVal;
                                        
                                        // Validate keyboard input when it reaches expected length
                                        if (!orderedLocs.includes(newVal)) {
                                            // console.log("LOGGING BAD SCAN - keyboard entry (real-time)");
                                            // await BadScanLogger.logBadScan({
                                            //     employeeId: user.employeeID || 'N/A',
                                            //     employeeName: user.employeeName || username || 'Unknown',
                                            //     scanType: 'Location',
                                            //     expected: orderedLocs,
                                            //     scanned: newVal
                                            // });
                                            
                                            setErrorMsg(`Incorrect Location \n ${newVal}`);
                                            playSound(wrongLocation);
                                            setModalVisible(true);
                                        }
                                    }
                                    
                                    if (showKeyboard === false && !orderedLocs.includes(newVal)) {
                                        // Log the bad location scan (wrong location, same length)
                                        // await BadScanLogger.logBadScan({
                                        //     employeeId: user.employeeID || 'N/A',
                                        //     employeeName: user.employeeName || username || 'Unknown',
                                        //     scanType: 'Location',
                                        //     expected: orderedLocs,
                                        //     scanned: newVal
                                        // });
                                        
                                        setErrorMsg(`Incorrect Location \n ${newVal}`);
                                        playSound(wrongLocation);
                                        setScannedLoc("");
                                        setModalVisible(true);
                                        // setTimeout(() => {
                                        //     setModalVisible(false);
                                        // }, 2000)
                                    } else if (showKeyboard === false && !orderedLocs.includes(newVal)) {
                                        // Log bad scan for wrong length (e.g., badge instead of location)
                                        // await BadScanLogger.logBadScan({
                                        //     employeeId: user.employeeID || 'N/A',
                                        //     employeeName: user.employeeName || username || 'Unknown',
                                        //     scanType: 'Location',
                                        //     expected: orderedLocs,
                                        //     scanned: newVal
                                        // });
                                        
                                        setErrorMsg(`Incorrect Location \n ${newVal}`);
                                        playSound(wrongLocation);
                                        setScannedLoc("");
                                        setModalVisible(true);
                                    } else if (showKeyboard === false && orderedLocs.includes(newVal)) {
                                        // Correct location scanned
                                        console.log("Setting scannedLoc (correct scan):", newVal);
                                        setScannedLoc(newVal);
                                        setSno(backfillItems[0].sNo);
                                        setAtLocation(true);
                                        // playSound(nextItem);
                                        // setTotalLocationsScanned(prevItems => prevItems + 1);
                                    } else if (showKeyboard === true && orderedLocs.includes(newVal)) {
                                        // Keyboard is enabled - just update the text field
                                        console.log("Setting scannedLoc (keyboard enabled):", newVal);
                                        setScannedLoc(newVal);
                                        setSno(backfillItems[0].sNo);
                                        setAtLocation(true);
                                        // playSound(nextItem);
                                    }
                                }}
                                onBlur={async () => {
                                    console.log("onBlur called - scannedLoc:", scannedLoc, "orderedLocs:", orderedLocs);
                                    // Validate when field loses focus (keyboard entry complete)
                                    if (showKeyboard && !orderedLocs.at(scannedLoc)) {
                                        console.log("LOGGING BAD SCAN - keyboard onBlur");
                                        // await BadScanLogger.logBadScan({
                                        //     employeeId: user.employeeID || 'N/A',
                                        //     employeeName: user.employeeName || username || 'Unknown',
                                        //     scanType: 'Location',
                                        //     expected: orderedLocs,
                                        //     scanned: scannedLoc
                                        // });
                                        
                                        setErrorMsg(`Incorrect Location \n ${scannedLoc}`);
                                        playSound(wrongLocation);
                                        setModalVisible(true);
                                    }
                                }}
                                autoFocus={true}
                                autoCapitalize='characters'
                                showSoftInputOnFocus={showKeyboard}
                                value={scannedLoc}
                            />
                            <TouchableOpacity onPress={() => {
                                handleEditIconPress();
                            }}>
                                <Image 
                                    style={{width: 50, 
                                        height: 50
                                    }}
                                    source={editIcon}
                                />
                            </TouchableOpacity>
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
                                        console.log("Tote onChangeText - newVal:", newVal);
                                        console.log("EMPLOYEE:", user.badgeId);
                                        if (locations.includes(newVal) || upcs.includes(newVal) || skus.includes(newVal) || aliasLists.includes(newVal) || itemMultipliers.includes(newVal) || newVal.startsWith("TA")) {
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

                                        if (newVal !== backfillItems[0].containerBarcode) {
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
                                    <Text
                                        style={{...styles.rectButton, backgroundColor: "rgb(0, 85, 165)", color: 'white', marginTop: 10, fontSize: 20, fontWeight: 'bold', height: 55, borderColor: 'black', borderWidth: 1}}>
                                            Next Container
                                    </Text>
                                </TouchableOpacity>
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
                                            console.log("scan match found");
                                            // updateContainer(1);
                                            setScannedQty(prevQty => prevQty + 1);

                                        } else if (backfillItems && multiplierFound && backfillItems[0].upcList[multiplierIndex].sellingUnitMultiplier + scannedQty <= orderedQty) {
                                            // updateContainer(order[0].upcList[multiplierIndex].sellingUnitMultiplier);
                                            setScannedQty(prevQty => prevQty + backfillItems[0].upcList[multiplierIndex].sellingUnitMultiplier);
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
                                            setModalVisible(true);
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
        </SafeAreaView>   
    )
}

export default Backfill;