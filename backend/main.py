import os
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import stripe
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize Stripe
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")

app = FastAPI()

# Allow CORS for local frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    message: str

class ChatResponse(BaseModel):
    response: str

class PaymentIntentRequest(BaseModel):
    amount: int  # Amount in cents
    currency: str = "usd"

class PaymentIntentResponse(BaseModel):
    client_secret: str
    payment_intent_id: str

@app.post("/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    # Simple echo bot logic
    return ChatResponse(response=f"You said: {request.message}")

@app.post("/create-payment-intent", response_model=PaymentIntentResponse)
async def create_payment_intent(request: PaymentIntentRequest):
    try:
        payment_intent = stripe.PaymentIntent.create(
            amount=request.amount,
            currency=request.currency,
            automatic_payment_methods={"enabled": True},
        )
        return PaymentIntentResponse(
            client_secret=payment_intent.client_secret,
            payment_intent_id=payment_intent.id
        )
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/stripe-config")
async def get_stripe_config():
    return {
        "publishable_key": os.getenv("STRIPE_PUBLISHABLE_KEY")
    }

@app.post("/webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, os.getenv("STRIPE_WEBHOOK_SECRET")
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError as e:
        raise HTTPException(status_code=400, detail="Invalid signature")

    # Handle the event
    if event["type"] == "payment_intent.succeeded":
        payment_intent = event["data"]["object"]
        print(f"Payment succeeded: {payment_intent['id']}")
    elif event["type"] == "payment_intent.payment_failed":
        payment_intent = event["data"]["object"]
        print(f"Payment failed: {payment_intent['id']}")

    return {"status": "success"}