from rest_framework import serializers
from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from .models import User

class UserSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id',
            'email',
            'username',
            'first_name',
            'last_name',
            'full_name',
            'role',
            'phone',
            'avatar',
            'is_active',
            'two_factor_enabled',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_full_name(self, obj):
        name = f"{obj.first_name} {obj.last_name}".strip()
        return name if name else obj.username or obj.email


class TeamMemberCreateSerializer(serializers.ModelSerializer):
    username = serializers.CharField(required=False, allow_blank=True)
    password = serializers.CharField(write_only=True, required=False, style={'input_type': 'password'})

    class Meta:
        model = User
        fields = [
            'id',
            'email',
            'username',
            'first_name',
            'last_name',
            'role',
            'phone',
            'password',
            'is_active',
        ]

    def validate_email(self, value):
        norm = value.strip().lower()
        if User.objects.filter(email__iexact=norm).exists():
            raise serializers.ValidationError("A user with this email address already exists.")
        return norm

    def create(self, validated_data):
        password = validated_data.pop('password', None)
        email = validated_data.pop('email').strip().lower()
        username = validated_data.pop('username', None)
        if not username:
            username = email.split('@')[0]

        # Default temporary password if none provided
        if not password:
            password = 'Roo4TechPassword2026!'

        user = User.objects.create_user(
            email=email,
            username=username,
            password=password,
            **validated_data
        )
        return user



class TeamMemberUpdateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = User
        fields = [
            'id',
            'email',
            'username',
            'first_name',
            'last_name',
            'role',
            'phone',
            'password',
            'is_active',
            'two_factor_enabled',
        ]

    def validate_email(self, value):
        norm = value.strip().lower()
        user_id = self.instance.id if self.instance else None
        if User.objects.filter(email__iexact=norm).exclude(id=user_id).exists():
            raise serializers.ValidationError("A user with this email address already exists.")
        return norm

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance


class LoginSerializer(serializers.Serializer):
    email = serializers.CharField(required=True)
    password = serializers.CharField(required=True, write_only=True)

    def validate(self, attrs):
        email_or_username = attrs.get('email', '').strip().lower()
        password = attrs.get('password')

        user = None
        # Try matching by email first
        try:
            matched_user = User.objects.get(email__iexact=email_or_username)
            if matched_user.check_password(password):
                user = matched_user
        except User.DoesNotExist:
            # Fall back to username
            try:
                matched_user = User.objects.get(username__iexact=email_or_username)
                if matched_user.check_password(password):
                    user = matched_user
            except User.DoesNotExist:
                pass

        if not user:
            raise serializers.ValidationError("Invalid email/username or password.")

        if not user.is_active:
            raise serializers.ValidationError("This account has been deactivated. Please contact an Administrator.")

        attrs['user'] = user
        return attrs


class PasswordChangeSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True, write_only=True)
    new_password = serializers.CharField(required=True, write_only=True)

    def validate_new_password(self, value):
        validate_password(value)
        return value


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)

    def validate_email(self, value):
        return value.strip().lower()


class PasswordResetConfirmSerializer(serializers.Serializer):
    token = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, write_only=True)

    def validate_new_password(self, value):
        validate_password(value)
        return value
