namespace Domain.Dtos;

public class CurrencyConversionDto
{
    public int FromCurrencyId { get; set; }
    public int ToCurrencyId { get; set; }
    public decimal Rate { get; set; }
}
