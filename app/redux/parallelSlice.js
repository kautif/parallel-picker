import { createSlice } from '@reduxjs/toolkit';
const initialState = {
    orders: [],
    containers: []
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
        }
    }
})

export const { addOrder, addContainer } = parallelSlice.actions;
export default parallelSlice.reducer;