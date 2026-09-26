<?php

namespace Database\Seeders;

use App\Models\Customer;
use Illuminate\Database\Seeder;

class CustomerSeeder extends Seeder
{
    public function run(): void
    {
        // 55xxx numbers are not allocated to Indian mobiles, so seeded data can
        // never WhatsApp a real person. Use your own number to test delivery.
        Customer::updateOrCreate(['email' => 'arun@example.com'], ['name' => 'Arun Kumar', 'phone' => '9578777764']);
        Customer::updateOrCreate(['email' => 'priya@example.com'], ['name' => 'Priya Ramasamy', 'phone' => '9092276443']);

        Customer::factory()->count(8)->create();
    }
}
