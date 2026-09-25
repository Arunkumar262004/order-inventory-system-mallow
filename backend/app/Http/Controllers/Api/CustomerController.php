<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\CustomerResource;
use App\Http\Resources\OrderResource;
use App\Models\Customer;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class CustomerController extends Controller
{
    /**
     * Look up a customer by email (used to auto-fill the name on the bill).
     */
    public function show(string $email): CustomerResource
    {
        return CustomerResource::make($this->findByEmail($email));
    }

    /**
     * A customer's order history, newest first.
     */
    public function orders(Request $request, string $email): AnonymousResourceCollection
    {
        $request->validate(['per_page' => ['nullable', 'integer', 'min:1', 'max:100']]);

        $customer = $this->findByEmail($email);

        $orders = $customer->orders()
            ->with('items.product')
            ->latest()
            ->latest('id')
            ->paginate($request->integer('per_page', 10))
            ->withQueryString();

        return OrderResource::collection($orders)
            ->additional(['customer' => CustomerResource::make($customer)]);
    }

    private function findByEmail(string $email): Customer
    {
        $customer = Customer::where('email', mb_strtolower(trim($email)))->first();

        abort_if($customer === null, 404, 'No customer found with that email.');

        return $customer;
    }
}
