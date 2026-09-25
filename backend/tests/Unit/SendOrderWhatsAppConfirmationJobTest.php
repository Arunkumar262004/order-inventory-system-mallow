<?php

namespace Tests\Unit;

use App\Jobs\SendOrderWhatsAppConfirmation;
use App\Models\Customer;
use App\Models\Order;
use App\Services\WhatsApp\WasenderClient;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class SendOrderWhatsAppConfirmationJobTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Http::preventStrayRequests();
        config([
            'services.wasender.token' => 'test-token',
            'services.wasender.url' => 'https://wasender.test/api/send-message',
        ]);
    }

    public function test_it_sends_the_bill_to_the_customers_whatsapp(): void
    {
        Http::fake(['wasender.test/*' => Http::response(['success' => true])]);
        $order = $this->orderFor('9876543210');

        (new SendOrderWhatsAppConfirmation($order))->handle(app(WasenderClient::class));

        Http::assertSent(fn (Request $request) => $request->url() === 'https://wasender.test/api/send-message'
            && $request->hasHeader('Authorization', 'Bearer test-token')
            && $request['to'] === '919876543210'
            && str_contains($request['body'], $order->order_number));
        $this->assertNotNull($order->fresh()->whatsapp_sent_at);
    }

    public function test_an_api_error_throws_so_the_queue_retries(): void
    {
        Http::fake(['wasender.test/*' => Http::response(['success' => false], 500)]);
        $order = $this->orderFor('9876543210');

        try {
            (new SendOrderWhatsAppConfirmation($order))->handle(app(WasenderClient::class));
            $this->fail('Expected a RequestException.');
        } catch (RequestException) {
            $this->assertNull($order->fresh()->whatsapp_sent_at);
        }
    }

    public function test_it_skips_when_not_configured_or_already_sent(): void
    {
        Http::fake();

        config(['services.wasender.token' => null]);
        (new SendOrderWhatsAppConfirmation($this->orderFor('9876543210')))->handle(app(WasenderClient::class));

        config(['services.wasender.token' => 'test-token']);
        $sent = $this->orderFor('9876543211', ['whatsapp_sent_at' => now()]);
        (new SendOrderWhatsAppConfirmation($sent))->handle(app(WasenderClient::class));

        Http::assertNothingSent();
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    private function orderFor(string $phone, array $attributes = []): Order
    {
        return Order::factory()
            ->for(Customer::factory()->state(['phone' => $phone]))
            ->create($attributes);
    }
}
