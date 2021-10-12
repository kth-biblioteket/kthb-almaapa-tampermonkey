## Holdshelf-nummer
Diverse Tampermokey-script för att göra anpassningar i alma

### 1. Se till att det krypterade löpnumret som finns på varje slip på holdshelf också blir synligt i Alma

Anropar API på lib.kth.se:

https://lib.kth.se/holdshelfno/api/v1/[userid]/[additionalID]"

[userid]/[additionalID] hämtas från almasidan av scriptet 

ex: testtl/216-464-549-8

Exempel på svar:
```xml
<holdshelfnumber>
   <records>1</records>
   <holdshelfnumber>004</holdshelfnumber>
   <userid_encrypted>vhvjbqay</userid_encrypted>
</holdshelfnumber>
```

##### To Do

