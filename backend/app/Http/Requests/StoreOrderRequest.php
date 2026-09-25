<?php

namespace App\Http\Requests;

use App\Models\Customer;
use App\Support\Phone;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class StoreOrderRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->customer_email)) {
            $this->merge(['customer_email' => mb_strtolower(trim($this->customer_email))]);
        }

        if (is_string($this->customer_phone)) {
            $this->merge(['customer_phone' => Phone::normalize($this->customer_phone)]);
        }
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'customer_email' => ['required', 'string', 'email', 'max:255'],
            'customer_name' => ['nullable', 'string', 'max:255'],
            'customer_phone' => ['nullable', 'string', 'regex:'.Phone::E164_PATTERN],
            'items' => ['required', 'array', 'min:1', 'max:50'],
            'items.*.product_id' => ['required', 'integer', 'distinct', 'exists:products,id'],
            'items.*.quantity' => ['required', 'integer', 'min:1', 'max:10000'],
            'amount_paid' => ['nullable', 'numeric', 'min:0', 'max:9999999999'],
        ];
    }

    /**
     * A name is mandatory only when the email does not belong to an
     * existing customer.
     *
     * @return array<int, callable>
     */
    public function after(): array
    {
        return [
            function (Validator $validator) {
                if ($validator->errors()->has('customer_email') || filled($this->customer_name)) {
                    return;
                }

                if (! Customer::where('email', $this->customer_email)->exists()) {
                    $validator->errors()->add('customer_name', 'A name is required for a new customer.');
                }
            },
            function (Validator $validator) {
                if ($validator->errors()->hasAny(['customer_email', 'customer_phone']) || blank($this->customer_phone)) {
                    return;
                }

                $takenByOther = Customer::where('phone', $this->customer_phone)
                    ->where('email', '!=', $this->customer_email)
                    ->exists();

                if ($takenByOther) {
                    $validator->errors()->add('customer_phone', 'This mobile number belongs to another customer.');
                }
            },
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'customer_phone.regex' => 'Enter a valid mobile number, e.g. 9876543210 or +91 98765 43210.',
            'items.required' => 'Add at least one product to the order.',
            'items.*.product_id.distinct' => 'Each product may appear only once; adjust the quantity instead.',
            'items.*.product_id.exists' => 'The selected product does not exist.',
            'items.*.quantity.min' => 'Quantity must be at least 1.',
        ];
    }
}
