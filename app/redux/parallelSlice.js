import { createSlice } from '@reduxjs/toolkit';
const initialState = {
    orders: [],
    backfillOrderIds: [],
    containers: [],
    initialBackfill: [],
    backfillOrders: [],
    backfillItems: [],
    backfillsArranged: [],
    mergedBackfills: [],
    verifiedOrders: [],
    isReturning: false,
    picksStarted: false,
    backfillCompleted: false
}

const parallelSlice = createSlice({
    name: 'parallel',
    initialState,
    reducers: {
        addOrder: (state, action) => {
            state.orders.push(action.payload);
        },
        addBackfillOrderIds: (state, action) => {
            if (Array.isArray(action.payload)) {
                state.backfillOrderIds.push(...action.payload);
            } else {
                state.backfillOrderIds.push(action.payload);
            }
        },
        addContainer: (state, action) => {
            state.containers.push(action.payload);
        },
        removeOrder: (state, action) => {
            state.orders.splice(action.payload, 1);
            // state.containers.splice(action.payload, 1);
        },
        removeContainer: (state, action) => {
            state.containers.splice(action.payload, 1);
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
            const target = state.backfillsArranged.find(obj => obj.orderId === action.payload.orderId);
            if (target) {
                target.order.push(action.payload);
            }
        },
        arrangeMergedBackfills: (state, action) => {
            state.mergedBackfills = action.payload;
        },
        setBackfillCompleted: (state, action) => {
            state.backfillCompleted = true;
        },
        setIsReturning: (state, action) => {
            state.isReturning = action.payload;
        },
        setPicksStarted: (state, action) => {
            state.picksStarted = action.payload;
        },
        addVerifiedOrder: (state, action) => {
            state.verifiedOrders.push(action.payload);
        },
        resetParallelState: (state) => {
            return initialState;
        }
    }
})

export const { addOrder, addBackfillOrderIds, addContainer, removeOrder, removeContainer, populateBackfill, addBackfill, queueBackfill, removeBackfillItem, addArrangedBackfillObj, addArrangedBackfillItem, arrangeMergedBackfills, setBackfillCompleted, setIsReturning, setPicksStarted, addVerifiedOrder, resetParallelState } = parallelSlice.actions;
export default parallelSlice.reducer;