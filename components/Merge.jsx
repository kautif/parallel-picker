import axios from 'axios';
import { Audio } from 'expo-av';
import { router } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, BackHandler, Modal, NativeModules, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { addArrangedBackfillObj, resetParallelState } from '../../ParallelPicker/app/redux/parallelSlice';
const { AudioRouter } = NativeModules;

const Merge = () => {
    const dispatch = useDispatch();
    const [currentOrder, setCurrentOrder] = useState(null);

    const backfillsArranged = useSelector(state => state.parallel.backfillsArranged);
    const backfillItems = useSelector(state => state.parallel.backfillItems);
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
    const [mergeArr, setMergeArr] = useState([]);
    const [mergeMsg, setMergeMsg] = useState("");
    const [errorMsg, setErrorMsg] = useState("");

    const [sound, setSound] = useState();

    const [modalVisible, setModalVisible] = useState(false);
    const [errorVisible, setErrorVisible] = useState(false);
    const mergeArrBuilt = useRef(false);

    // Plain array instead of Set — reliable React re-renders
    const [mergedOrders, setMergedOrders] = useState([]);

    // Toast state
    const [toastMsg, setToastMsg] = useState("");
    const toastOpacity = useRef(new Animated.Value(0)).current;

    const wrongItem = require('../../WarehouseScanner/assets/sounds/wrong_item.mp3');
    const mergeDone = require('../../WarehouseScanner/assets/sounds/merge_completed.mp3');

    function showToast(msg) {
        setToastMsg(msg);
        Animated.sequence([
            Animated.timing(toastOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
            Animated.delay(2000),
            Animated.timing(toastOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
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
                    dispatch(addArrangedBackfillObj(response.data.data));
                    // setHasMerge(true);
                } 
                // else {
                //     setHasMerge(false);
                // } 
                // console.log("merge update success for item:", item.orderBackFillItemsId);
            } else {
                // console.log("merge update failure:", response.data.reason);
            }
        } catch (err) {
            console.log("merge update error");
            console.error(err.message);
        }
    }

    async function updateMergedItem(item) {
        try {
            const response = await axios.post('http://192.168.2.165/api/Order/updateBackFillItemMerge', {
                token: "Yh2k7QSu4l8CZg5p6X3Pna9L0Miy4D3Bvt0JVr87UcOj69Kqw5R2Nmf4FWs03Hdx",
                employeeId: user.employeeID,
                orderBackFillItemsId: item.orderBackFillItemsId,
                pickLocation: item.pickLocation,
                scannedQty: item.mergedQty,
                containerItems: [
                    {
                        containerBarcode: item.containerBarcode,
                        qty: item.mergedQty
                    }
                ]
            });

            if (response.data.success) {
                // console.log("merge update success for item:", item.orderBackFillItemsId);
            } else {
                // console.log("merge update failure:", response.data.reason);
            }
        } catch (err) {
            console.log("merge update error");
            console.error(err.message);
        }
    }

    useEffect(() => {
        ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE_LEFT);
    });

    useEffect(() => {
        console.log("MERGE: ", backfillItems);
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
        if (backfillsArranged.length > 0) {
            const flatItems = backfillsArranged.flat().filter(
                (item, index, self) =>
                    index === self.findIndex(i => i.orderBackFillItemsId === item.orderBackFillItemsId)
            );

            const uniqueOrderIds = [...new Set(flatItems.map(item => item.orderId))];
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
        if (orders.length > 0 && mergedOrders.length === orders.length) {
            // all orders merged
            dispatch(resetParallelState());
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
                return prev; // return unchanged array
            }
            matched.mergedQty += increment;
            updated[matchIndex] = matched;

if (matched.mergedQty === matched.scannedQty) {
    updateMergedItem(matched).then(() => {
        const orderStillHasItems = updated.some(
            item => parseInt(item.orderId) === currentOrderId && item.mergedQty < item.scannedQty
        );

        if (!orderStillHasItems) {
            setMergedOrders(prev => [...prev, currentOrderLabel]);
            setMergeMsg(`${currentOrderLabel} merged`);
            setCurrentOrder(null);
            setModalVisible(true);
        }
    });
}

            return updated;
        });

        setScanText("");
    }, [scanText]);

    return (
        <SafeAreaView>
            {orders.length > 0 && orders.map((order, i) => {
                if (currentOrder !== null) return null;
                const isMerged = mergedOrders.includes(order);
                return (
                    <TouchableOpacity key={order} onPress={() => handleOrderPress(i, order)}>
                        <View style={styles.orderRow}>
                            <Text style={[styles.orderNum, isMerged && styles.orderNumMerged]}>
                                {order}
                            </Text>
                            {isMerged && (
                                <Text style={styles.checkmark}>✓</Text>
                            )}
                        </View>
                    </TouchableOpacity>
                );
            })}
            <Modal
                animationType="slide"
                transparent={true}
                visible={modalVisible || errorVisible}
                onRequestClose={() => {
                    setMergeMsg("");
                    setModalVisible(false);
                    setErrorMsg("");
                    setErrorVisible(false);
                }}
            >
                <View style={styles.centeredView}>
                    <View style={styles.modalView}>
                        <Text style={styles.modalText}>{mergeMsg || errorMsg}</Text>
                        <TouchableOpacity
                            style={{...styles.button, marginLeft: 'auto', marginRight: 'auto', marginTop: '20', backgroundColor: "rgb(0, 85, 165)", paddingHorizontal: 20, textAlign: 'center'}}
                            onPress={() => {
                                setMergeMsg("");
                                setModalVisible(false);
                                setErrorMsg("");
                                setErrorVisible(false);

                                if (mergedOrders.length === orders.length) {
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
                    </View>
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
                <Text style={styles.orderNum}>{orders[currentOrder]}</Text>
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
                <TouchableOpacity
                    style={{...styles.clearButton, ...styles.cancelButton}}
                    onPress={() => setCurrentOrder(null)}
                >
                    <Text style={styles.clearButtonText}>Back</Text>
                </TouchableOpacity>
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
        bottom: 40,
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