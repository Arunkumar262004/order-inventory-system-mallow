<?php

namespace Database\Factories;

use App\Models\Reminder;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Reminder>
 */
class ReminderFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'title' => fake()->sentence(4),
            'notes' => null,
            'due_at' => now()->addDay(),
        ];
    }

    public function overdue(): static
    {
        return $this->state(['due_at' => now()->subHour()]);
    }

    public function completed(): static
    {
        return $this->state(['completed_at' => now()]);
    }
}
