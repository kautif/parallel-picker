import axios from 'axios';
import { Audio } from 'expo-av';
import { router } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import React, { useEffect, useRef, useState } from 'react';
import { Image, Modal, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { addBackfill, addBackfillOrderIds, addContainer, addOrder, populateBackfill, queueBackfill, removeContainer, removeOrder, setIsReturning, setPicksStarted } from '../app/redux/parallelSlice';

// Version 0.1
// 3/12/26: The purpose that addBackfill serves on line 74 isn't necessary. Remove it. Also, add a dispatch action/function to retain the original order to reference later
const trashIcon = require('../assets/images/delete.png');

const Prepare = ({navigation}) => {
    const dispatch = useDispatch();
    const containers = useSelector(state => state.parallel.containers);
    const orders = useSelector(state => state.parallel.orders);
    const [order, setOrder] = useState("");
    const [container, setContainer] = useState("");
    const [modalVisible, setModalVisible] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");
    const [hasMerge, setHasMerge] = useState(false);
    const [logoutVisible, setLogoutVisible] = useState(false);
    // const [picksStarted, setPicksStarted] = useState(false);

    const orderRef = useRef('');
    const containerRef = useRef('');

    const user = useSelector(state => state.user.user);
    const backfillOrders = useSelector(state => state.parallel.backfillOrders);
    const backfillItems = useSelector(state => state.parallel.backfillItems);
    const initialBackfill = useSelector(state => state.parallel.initialBackfill);
    const picksStarted = useSelector(state => state.parallel.picksStarted); 
    const mergedBackfills = useSelector(state => state.parallel.mergedBackfills);

    const buzzer = require('../../WarehouseScanner/assets/sounds/buzzer.mp3');
    const logoutDoor = require('../../WarehouseScanner/assets/images/logout_door.png');

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

    async function getBackFillDetails () {
        console.log("starting getBackfill");
        try {
            console.log("entering getBackfill try");
            console.log("backfill orders: ", orders);
            const response = await axios.post('http://192.168.2.165/api/Order/getBackFillDetails' , {
                token: "Yh2k7QSu4l8CZg5p6X3Pna9L0Miy4D3Bvt0JVr87UcOj69Kqw5R2Nmf4FWs03Hdx",
                EmployeeId: user.employeeID,
                Orders: backfillOrders
            })

            if (response.data.success) {
                console.log("backfill success");
                dispatch(populateBackfill(response.data.data));
                // console.log("response: ", response);
                // dispatch(queueBackfill(response.data.data));
                let pruneBackfill = [];
                for (let i = 0; i < response.data.data.length; i++) {
                    if (response.data.data[i].scannedQty < response.data.data[i].orderedQty) {
                        pruneBackfill.push(response.data.data[i]);
                    }
                }
                dispatch(queueBackfill(pruneBackfill));
            } else {
                console.log("backfill failure");
                console.log(response.data.reason);
            }
        } catch (err) {
            console.log("backfill error");
            console.error(err.message);
            console.log(err.response?.data?.reason);
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

    async function getPendingBackfills () {
        console.log("retrieving remaining backfills");
    try {
            const response = await axios.post('http://192.168.2.165/api/Order/getBackFillByEmployeeId' , {
                token: "Yh2k7QSu4l8CZg5p6X3Pna9L0Miy4D3Bvt0JVr87UcOj69Kqw5R2Nmf4FWs03Hdx",
                employeeId: user.employeeID,
            })

            console.log("backfill success: ", response.data.success);
            if (response.data.success && response.data.data.length > 0) {
                dispatch(setIsReturning(true));
                dispatch(setPicksStarted(true));
                const orderPayload = [...new Set(response.data.data.map(item => item.orderId))]
                .map(id => ({ orderId: id }));
                dispatch(addBackfillOrderIds(orderPayload));
                console.log("backfill success");
                // dispatch(populateBackfill(response.data.data));
                // console.log("response: ", response);
                // dispatch(queueBackfill(response.data.data));
                let pruneBackfill = [];
                for (let i = 0; i < response.data.data.length; i++) {
                    if (response.data.data[i].scannedQty < response.data.data[i].orderedQty) {
                        pruneBackfill.push(response.data.data[i]);
                    }

                    if (response.data.data[i].pickCompleted === true) {
                        // dispatch(setPicksStarted(true));
                    }
                }
                dispatch(queueBackfill(pruneBackfill));
            } else {
                if (hasMerge) {
                    router.push('/picker/merge');
                }
            }
        } catch (err) {
            console.log("backfill recovery error");
            console.error(err.message);
            console.log(err.response?.data?.reason);
        }
    }

async function getMergedBackfills () {
    console.log("merged emp id: ", user.employeeID);
    try {
        const response = await axios.post('http://192.168.2.165/api/Order/getBackFillMergeByEmployeeId', {
            token: "Yh2k7QSu4l8CZg5p6X3Pna9L0Miy4D3Bvt0JVr87UcOj69Kqw5R2Nmf4FWs03Hdx",
            employeeId: user.employeeID
        });

        if (response.data.success) {
            if (response.data.data.length > 0) {
                let pruneBackfill = [];
                for (let i = 0; i < response.data.data.length; i++) {
                    if (response.data.data[i].mergeCompleted === false) {
                        pruneBackfill.push(response.data.data[i]);
                    }
                }
                if (pruneBackfill.length > 0) {
                    dispatch(queueBackfill(pruneBackfill));
                    setHasMerge(true);
                    console.log("getMerged: ", hasMerge);
                }
            }
        } 
    } catch (err) {
        console.log("merge update error");
        console.error(err.message);
    }
}


    useEffect(() => {
        getMergedBackfills();

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
        console.log("hasMerge: ", hasMerge);
        if (hasMerge === false) {
            getPendingBackfills();
        }

        if (hasMerge === true) {
            router.push('/picker/merge');
        }
    }, [hasMerge])

    useEffect(() => {
        if (order.length >= 6) {
            setTimeout(() => {
                containerRef.current?.focus();
            }, 500)
        }
    }, [order])

    useEffect(() => {
        if (container.length >= 6 && order.length >= 6) {
            dispatch(addOrder(order));
            dispatch(addBackfillOrderIds({
                orderId: order
            }));
            dispatch(addContainer(container));
            dispatch(addBackfill({
                OrderId: order,
                ContainerBarcode: container
            }))
            setTimeout(() => {
                orderRef.current?.focus();
            }, 500)
        }
    }, [container])

    useEffect(() => {
        console.log("backfillOrders: ", backfillOrders);
    }, [backfillOrders])

    useEffect(() => {
        if (backfillItems.length > 0 && hasMerge === false && picksStarted === true) {
            console.log("backfillItems: ", backfillItems);
            router.push('/picker/backfill');
        }
    }, [backfillItems])

    useEffect(() => {
        if (initialBackfill.length > 0 && hasMerge === false) {
            console.log("GO TO BACKFILL");
            router.push('/picker/backfill');
        }
    }, [initialBackfill])

    useEffect(() => {
        if ((orders.length > 0 && containers.length > 0) && orders[orders.length - 1].length >= 6 && containers[containers.length - 1].length >= 6) {
            setOrder("");
            setContainer("");
        }

        console.log("orders: ", orders);
        console.log("containers: ", containers);
    }, [orders, containers])

    return (
    <SafeAreaView>
        <SafeAreaView style={styles.modalContainer}>
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
                visible={modalVisible}
                onRequestClose={() => {
                    setErrorMsg("");
                    setModalVisible(false);
                }}
                >
                    <View style={styles.centeredView}>
                        <View style={styles.modalView}>
                            <Text style={styles.modalText}>{errorMsg}</Text>
                            <TouchableOpacity style={{...styles.button, marginLeft: 'auto', marginRight: 'auto', marginTop: '20', backgroundColor: "rgb(0, 85, 165)", paddingHorizontal: 20, textAlign: 'center'}} onPress={() =>{
                                setModalVisible(false);
                                setErrorMsg("");
                            }}>
                                <Text style={{color: 'white', fontSize: 20}}>Close</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
            </Modal>
        </SafeAreaView>
        <SafeAreaView style={{...styles.container, position: 'absolute'}}>
            <Text style={{...styles.label, height: 45}}>Orders</Text>
            {orders.map((item, i) => {
                return <View key={i} style={{flexDirection: 'row', justifyContent: 'space-between', width: '25%'}}>
                    <Text style={{fontSize: 20}}>{item}</Text>
                    <TouchableOpacity key={`delete-${i}`} onPress={() => {
                        dispatch(removeOrder(i));
                        dispatch(removeContainer(i));
                    }}><Image style={{width: 30, height: 30}}source={trashIcon} alt="delete icon" /></TouchableOpacity>
                </View>
            })}
        </SafeAreaView>
        <View style={styles.container}>
            <View style={styles.inputContainer}>
                <Text style={styles.label}>Order</Text>
                <TextInput style={styles.textInput}
                    ref={orderRef}
                    autoFocus={true}
                    showSoftInputOnFocus={false}
                    editable={orders.length < 4}
                    onChangeText={(newVal) => {
                        if (orders.includes(newVal)) {
                            setErrorMsg("Order already added");
                            playSound(buzzer);
                            setModalVisible(true);
                        } else if (containers.includes(newVal) || newVal === container) {
                            setErrorMsg("You scanned a container");
                            playSound(buzzer);
                            setModalVisible(true);
                        } else {
                            setOrder(newVal);
                        }
                }}
                    value={order}></TextInput>
            </View>
            <View style={styles.inputContainer}>
                <Text style={styles.label}>Container</Text>
                <TextInput style={styles.textInput}
                    ref={containerRef}
                    showSoftInputOnFocus={false}
                    editable={containers.length < 4}
                    onChangeText={(newVal) => {
                        if (orders.includes(newVal) || newVal === order) {
                            setErrorMsg("You scanned an order");
                            playSound(buzzer);
                            setModalVisible(true);
                        } else if (containers.includes(newVal)) {
                            setErrorMsg("Container already added");
                            playSound(buzzer);
                            setModalVisible(true);
                        } else {
                            setContainer(newVal);
                        }
                    }}
                    value={container}
                ></TextInput>
            </View>
            <TouchableOpacity style={styles.button} onPress={() => {
                getBackFillDetails();
            }}>
                <Text style={styles.buttonText}>Next</Text>
            </TouchableOpacity>
        </View>
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
    </SafeAreaView>
    )
}

const styles = StyleSheet.create({
    container: {
        marginTop: 'auto',
        // flexDirection: 'row',
        flexWrap: 'wrap',
        alignContent: 'flex-end',
        justifyContent: 'space-around',
        width: '100%'
    },
    inputContainer: {
        marginLeft: 'auto',
        marginRight: 30,
        flexDirection: 'column',
        width: '45%'
    },
    label: {
        fontSize: 30,
        textAlign: 'center',
        marginBottom: 10
    },
    textInput: {
        backgroundColor: '#FFF',
        borderWidth: 1,
        width: '100%',
        marginHorizontal: 'auto',
        marginBottom: 30
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
        // alignSelf: 'center',
        marginLeft: 75,
    },
    buttonText: {
        color: '#FFF',
        fontSize: 15,
        textAlign: 'center',
    }
})

export default Prepare;