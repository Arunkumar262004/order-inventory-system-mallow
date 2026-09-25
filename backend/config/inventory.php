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

    /*
    |--------------------------------------------------------------------------
    | Default Country Code
    |--------------------------------------------------------------------------
    |
    | Prefixed to local 10-digit mobile numbers when normalising them to
    | E.164 (e.g. 9876543210 -> +919876543210).
    |
    */

    'default_country_code' => (string) env('DEFAULT_COUNTRY_CODE', '91'),

];
