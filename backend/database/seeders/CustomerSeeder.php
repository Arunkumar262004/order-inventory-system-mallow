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
        Customer::updateOrCreate(['email' => 'thomas@example.com'], ['name' => 'Thomas Shelby', 'phone' => '5550001111']);
        Customer::updateOrCreate(['email' => 'priya@example.com'], ['name' => 'Priya Raman', 'phone' => '5550002222']);

        Customer::factory()->count(8)->create();
    }
}
