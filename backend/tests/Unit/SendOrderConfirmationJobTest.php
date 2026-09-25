<?php

namespace Tests\Unit;

use App\Jobs\SendOrderConfirmation;
use App\Mail\OrderConfirmationMail;
use App\Models\Order;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class SendOrderConfirmationJobTest extends TestCase
{
    use RefreshDatabase;

    public function test_the_job_is_queued_not_run_inline(): void
    {
        $this->assertContains(ShouldQueue::class, class_implements(SendOrderConfirmation::class));
    }

    public function test_it_mails_the_customer_and_marks_the_order_confirmed(): void
    {
        Mail::fake();
        $order = Order::factory()->create();

        (new SendOrderConfirmation($order))->handle();

        Mail::assertSent(OrderConfirmationMail::class, fn ($mail) => $mail->hasTo($order->customer->email));
        $this->assertNotNull($order->fresh()->confirmation_sent_at);
    }

    public function test_it_does_not_send_twice_on_retry(): void
    {
        Mail::fake();
        $order = Order::factory()->create(['confirmation_sent_at' => now()]);

        (new SendOrderConfirmation($order))->handle();

        Mail::assertNothingSent();
    }
}
