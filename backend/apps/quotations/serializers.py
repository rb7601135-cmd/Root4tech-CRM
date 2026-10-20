from rest_framework import serializers
from decimal import Decimal
from django.db import transaction
from django.utils import timezone
from .models import Quotation, QuotationItem
from apps.clients.models import Client
from apps.clients.serializers import ClientListSerializer
from apps.leads.models import Lead
from apps.accounts.serializers import UserSerializer
from apps.company.models import ExchangeRate

class QuotationItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuotationItem
        fields = ['id', 'item_order', 'description', 'quantity', 'unit_price', 'line_total']
        read_only_fields = ['id', 'line_total']


class QuotationSerializer(serializers.ModelSerializer):
    items = QuotationItemSerializer(many=True, required=False)
    client_details = ClientListSerializer(source='client', read_only=True)
    salesperson_details = UserSerializer(source='salesperson', read_only=True)
    created_by_details = UserSerializer(source='created_by', read_only=True)

    class Meta:
        model = Quotation
        fields = [
            'id',
            'quotation_number',
            'title',
            'client',
            'client_details',
            'related_lead',
            'salesperson',
            'salesperson_details',
            'status',
            'issue_date',
            'expiry_date',
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
            'terms_and_conditions',
            'internal_notes',
            'client_snapshot',
            'is_converted_to_project',
            'converted_project_id',
            'is_converted_to_invoice',
            'converted_invoice_id',
            'items',
            'created_by',
            'created_by_details',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'quotation_number',
            'subtotal',
            'total_amount',
            'client_snapshot',
            'is_converted_to_project',
            'converted_project_id',
            'is_converted_to_invoice',
            'converted_invoice_id',
            'created_by',
            'created_at',
            'updated_at',
        ]

    def create(self, validated_data):
        items_data = validated_data.pop('items', [])
        
        # Set exchange rate snapshot if not provided
        currency = validated_data.get('currency', 'PKR')
        if 'exchange_rate_to_base' not in validated_data or validated_data['exchange_rate_to_base'] == Decimal('1.0000'):
            rate_obj = ExchangeRate.objects.filter(currency_code=currency).first()
            if rate_obj:
                validated_data['exchange_rate_to_base'] = rate_obj.rate_to_base
                validated_data['exchange_rate_source'] = rate_obj.source
                validated_data['exchange_rate_date'] = timezone.now()

        with transaction.atomic():
            quotation = Quotation.objects.create(**validated_data)
            
            for idx, item_data in enumerate(items_data):
                item_order = item_data.get('item_order', idx + 1)
                QuotationItem.objects.create(
                    quotation=quotation,
                    item_order=item_order,
                    description=item_data.get('description', ''),
                    quantity=item_data.get('quantity', Decimal('1.00')),
                    unit_price=item_data.get('unit_price', Decimal('0.00'))
                )
            
            quotation.calculate_totals()
            quotation.save()

        return quotation

    def update(self, instance, validated_data):
        items_data = validated_data.pop('items', None)

        # If currency changed and user did not specify custom rate, update rate snapshot
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
                    QuotationItem.objects.create(
                        quotation=instance,
                        item_order=item_data.get('item_order', idx + 1),
                        description=item_data.get('description', ''),
                        quantity=item_data.get('quantity', Decimal('1.00')),
                        unit_price=item_data.get('unit_price', Decimal('0.00'))
                    )

            instance.calculate_totals()
            instance.save()

        return instance
