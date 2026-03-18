import { createSlice } from '@reduxjs/toolkit';
const initialState = {
    orders: [],
    containers: [],
    initialBackfill: [],
    backfillOrders: [],
    backfillItems: [],
    backfillsArranged: []
}

const parallelSlice = createSlice({
    name: 'parallel',
    initialState, 
    reducers: {
        addOrder: (state, action) => {
            state.orders.push(action.payload);
        },
        addContainer: (state, action) => {
            state.containers.push(action.payload);
        },
        removeOrder: (state, action) => {
            state.orders.splice(action.payload, 1);
            console.log("order index: ", action.payload);
        },
        removeContainer: (state, action) => {
            // state.containers.splice(action.payload, 1);
        },
        populateBackfill: (state, action) => {
            state.initialBackfill = action.payload;
        },
        addBackfill: (state, action) => {
            state.backfillOrders.push(action.payload);
        },
        queueBackfill: (state, action) => {
            state.backfillItems = action.payload;
        },
        removeBackfillItem: (state, action) => {
            state.backfillItems = state.backfillItems.slice(1);
        },
        addArrangedBackfillObj: (state, action) => {
            state.backfillsArranged.push(action.payload);
        },
        addArrangedBackfillItem: (state, action) => {
            console.log("running addArrangedBackfillItem specific");
            const target = state.backfillsArranged.find(obj => obj.orderId === action.payload.orderId);
            if (target) {
                target.order.push(action.payload);
            }
        }
    }
})

export const { addOrder, addContainer, removeOrder, removeContainer, populateBackfill, addBackfill, queueBackfill, removeBackfillItem, addArrangedBackfillObj, addArrangedBackfillItem } = parallelSlice.actions;
export default parallelSlice.reducer;