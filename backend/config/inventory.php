<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Low Stock Threshold
    |--------------------------------------------------------------------------
    |
    | Products with stock strictly below this number are reported by the
    | low-stock endpoint. Callers may override it per request with the
    | "threshold" query parameter.
    |
    */

    'low_stock_threshold' => (int) env('LOW_STOCK_THRESHOLD', 10),

];
