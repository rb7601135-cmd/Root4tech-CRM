from rest_framework import serializers
from decimal import Decimal
from django.db import transaction
from django.utils import timezone
from .models import Invoice, InvoiceItem, Payment
from apps.clients.serializers import ClientListSerializer
from apps.accounts.serializers import UserSerializer
from apps.company.models import ExchangeRate

class InvoiceItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = InvoiceItem
        fields = ['id', 'item_order', 'description', 'quantity', 'unit_price', 'line_total']
        read_only_fields = ['id', 'line_total']


class PaymentSerializer(serializers.ModelSerializer):
    invoice_number = serializers.ReadOnlyField(source='invoice.invoice_number')
    client_name = serializers.ReadOnlyField(source='client.name')
    client_id = serializers.ReadOnlyField(source='client.client_id')
    recorded_by_name = serializers.ReadOnlyField(source='recorded_by.full_name')

    class Meta:
        model = Payment
        fields = [
            'id',
            'receipt_number',
            'invoice',
            'invoice_number',
            'client',
            'client_name',
            'client_id',
            'amount',
            'currency',
            'payment_date',
            'payment_method',
            'transaction_reference',
            'notes',
            'recorded_by',
            'recorded_by_name',
            'created_at',
        ]
        read_only_fields = ['id', 'receipt_number', 'client', 'currency', 'recorded_by', 'created_at']

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Payment amount must be greater than zero.")
        return value

    def validate(self, data):
        invoice = data.get('invoice')
        amount = data.get('amount')
        if invoice and amount:
            if amount > invoice.remaining_balance:
                raise serializers.ValidationError({
                    'amount': f"Payment amount ({amount} {invoice.currency}) exceeds remaining balance ({invoice.remaining_balance} {invoice.currency})."
                })
        return data


class InvoiceSerializer(serializers.ModelSerializer):
    items = InvoiceItemSerializer(many=True, required=False)
    payments = PaymentSerializer(many=True, read_only=True)
    client_details = ClientListSerializer(source='client', read_only=True)
    created_by_details = UserSerializer(source='created_by', read_only=True)

    class Meta:
        model = Invoice
        fields = [
            'id',
            'invoice_number',
            'title',
            'client',
            'client_details',
            'quotation',
            'project',
            'status',
            'issue_date',
            'due_date',
            'currency',
            'exchange_rate_to_base',
            'exchange_rate_source',
            'exchange_rate_date',
            'subtotal',
            'discount_percentage',
            'discount_amount',
            'tax_percentage',
            'tax_amount',
            'total_amount',
            'amount_paid',
            'remaining_balance',
            'terms_and_conditions',
            'internal_notes',
            'client_snapshot',
            'items',
            'payments',
            'created_by',
            'created_by_details',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'invoice_number',
            'subtotal',
            'total_amount',
            'amount_paid',
            'remaining_balance',
            'client_snapshot',
            'created_by',
            'created_at',
            'updated_at',
        ]

    def create(self, validated_data):
        items_data = validated_data.pop('items', [])
        currency = validated_data.get('currency', 'PKR')

        if 'exchange_rate_to_base' not in validated_data or validated_data['exchange_rate_to_base'] == Decimal('1.0000'):
            rate_obj = ExchangeRate.objects.filter(currency_code=currency).first()
            if rate_obj:
                validated_data['exchange_rate_to_base'] = rate_obj.rate_to_base
                validated_data['exchange_rate_source'] = rate_obj.source
                validated_data['exchange_rate_date'] = timezone.now()

        with transaction.atomic():
            invoice = Invoice.objects.create(**validated_data)
            for idx, item_data in enumerate(items_data):
                InvoiceItem.objects.create(
                    invoice=invoice,
                    item_order=item_data.get('item_order', idx + 1),
                    description=item_data.get('description', ''),
                    quantity=item_data.get('quantity', Decimal('1.00')),
                    unit_price=item_data.get('unit_price', Decimal('0.00'))
                )
            invoice.calculate_totals()
            invoice.save()

        return invoice

    def update(self, instance, validated_data):
        items_data = validated_data.pop('items', None)

        new_currency = validated_data.get('currency', instance.currency)
        if new_currency != instance.currency and 'exchange_rate_to_base' not in validated_data:
            rate_obj = ExchangeRate.objects.filter(currency_code=new_currency).first()
            if rate_obj:
                validated_data['exchange_rate_to_base'] = rate_obj.rate_to_base
                validated_data['exchange_rate_source'] = rate_obj.source
                validated_data['exchange_rate_date'] = timezone.now()

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        with transaction.atomic():
            instance.save()

            if items_data is not None:
                instance.items.all().delete()
                for idx, item_data in enumerate(items_data):
                    InvoiceItem.objects.create(
                        invoice=instance,
                        item_order=item_data.get('item_order', idx + 1),
                        description=item_data.get('description', ''),
                        quantity=item_data.get('quantity', Decimal('1.00')),
                        unit_price=item_data.get('unit_price', Decimal('0.00'))
                    )

            instance.calculate_totals()
            instance.save()

        return instance
