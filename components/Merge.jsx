import React, { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';

const Merge = () => {
    const backfillsArranged = useSelector(state => state.parallel.backfillsArranged);
    const initialBackfill = useSelector(state => state.parallel.initialBackfill);
    const orders = useSelector(state => state.parallel.orders);
    const [ordersToMerge, setOrdersToMerge] = useState([]);

    let ordersArr = [];

    useEffect(() => {
        console.log("merge backfill: ", orders);
        for (let i = 0; i < orders.length; i++) {
            ordersArr.push({
                orderId: orders[i],
                order: []
            })
        }

        ordersArr.map(order => {
            // let ordersArr = [];
            for (let i = 0; i < initialBackfill.length; i++) {
                if (parseInt(initialBackfill[i].orderId) === parseInt(order.orderId)) {
                    order.order.push(initialBackfill[i]);
                }
            }
        })

        console.log("orderArr: ", ordersArr);
    }, [])

    return (
        <SafeAreaView>
            <Text>Merge</Text>
        </SafeAreaView>
    )
}

export default Merge;