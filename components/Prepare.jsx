import React, { useEffect, useRef, useState } from 'react';
import { Alert, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { SafeAreaView } from 'react-native-safe-area-context';
import { addContainer, addOrder } from '@/app/redux/parallelSlice';

// Version 0.1

const Prepare = ({navigation}) => {
    const dispatch = useDispatch();
    const containers = useSelector(state => state.parallel.containers);
    const orders = useSelector(state => state.parallel.orders);
    const [order, setOrder] = useState("");
    const [container, setContainer] = useState("");
    const [modalVisible, setModalVisible] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");

    const orderRef = useRef('');
    const containerRef = useRef('');

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
            dispatch(addContainer(container));
            setTimeout(() => {
                orderRef.current?.focus();
            }, 500)
        }
    }, [container])

    useEffect(() => {
        if ((orders.length > 0 && containers.length > 0) && orders[orders.length - 1].length >= 6 && containers[containers.length - 1].length >= 6) {
            setOrder("");
            setContainer("");
        }
    }, [orders, containers])

    return (
    <SafeAreaView>
        <SafeAreaView style={styles.modalContainer}>
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
            <Text style={styles.label}>Orders</Text>
            {orders.map((item, i) => {
                return <Text style={{fontSize: 20}} key={i}>{item}</Text>
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
                            setModalVisible(true);
                        } else if (containers.includes(newVal) || newVal === container) {
                            setErrorMsg("You scanned a container");
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
                            setModalVisible(true);
                        } else if (containers.includes(newVal)) {
                            setErrorMsg("Container already added");
                            setModalVisible(true);
                        } else {
                            setContainer(newVal);
                        }
                    }}
                    value={container}
                ></TextInput>
            </View>
            <TouchableOpacity style={styles.button}>
                <Text style={styles.buttonText}>Next</Text>
            </TouchableOpacity>
        </View>
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