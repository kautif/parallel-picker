import { configureStore } from '@reduxjs/toolkit';
import parallelReducer from './parallelSlice';

export const store = configureStore({
    reducer: {
        parallel: parallelReducer
    }
})