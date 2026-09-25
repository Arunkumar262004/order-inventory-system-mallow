<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\LowStockRequest;
use App\Http\Resources\ProductResource;
use App\Models\Product;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class ProductController extends Controller
{
    public function index(): AnonymousResourceCollection
    {
        return ProductResource::collection(Product::orderBy('name')->get());
    }

    public function lowStock(LowStockRequest $request): AnonymousResourceCollection
    {
        $threshold = $request->threshold();

        return ProductResource::collection(
            Product::belowStock($threshold)->orderBy('stock')->orderBy('name')->get()
        )->additional(['meta' => ['threshold' => $threshold]]);
    }
}
