import { StyleSheet } from "react-native";

export default StyleSheet.create({
    heading: {
        fontSize: 25,
        textAlign: "center",
        marginTop: 30
    },
    itemText: {
        fontSize: 15,
        textAlign: "center",
        marginVertical: 10
    }, 
    inputField: {
        width: 75,
        marginTop: 5,
        padding: 5,
        backgroundColor: '#fff'
    },
    scanContainer: {
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'space-around',
        flex: 1,
        backgroundColor: '#dad5d5ff',
        paddingTop: 10
    },
    button: {
        marginTop: 25,
        fontSize: 15,
        padding: 10,
        width: 100,
        backgroundColor: "#f7f6d9ff",
        textAlign: "center"
    },
    centeredView: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        width: 600
    },
    modalContainer: {
        flex: 1,
        position: 'absolute',
        backgroundColor: 'black',
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
    button: {
        borderRadius: 20,
        padding: 10,
        elevation: 2,
        backgroundColor: '#FFFFFF'
    },
    buttonOpen: {
        backgroundColor: '#F194FF',
    },
    buttonClose: {
        backgroundColor: '#2196F3',
    },
    rectButton: {
        height: 40,
        marginTop: 20,
        width: 125,
        marginLeft: 'auto',
        marginRight: 'auto',
        textAlign: 'center',
        backgroundColor: "#f5f8dfff",
        verticalAlign: "middle"
    },
    textStyle: {
        color: 'white',
        fontWeight: 'bold',
        textAlign: 'center',
    },
    clearButton: {
    marginTop: 20,
    backgroundColor: 'rgb(0, 85, 165)',
    padding: 10,
    width: 110,
    },
  clearButtonText: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 18,
    fontWeight: 'bold',
    },
    modalText: {
        marginBottom: 5,
        textAlign: 'center',
        fontSize: 20
    },
    modalCover: {
        height: 500
    },
    modalVeil: {
        height: 0
    }
})