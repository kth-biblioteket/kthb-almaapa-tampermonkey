## Holdshelf-nummer
Tampermonkey-script som ser till att det krypterade löpnumret som finns på varje slip på holdshelf också blir synligt i Alma

Anropar API på lib.kth.se:

https://lib.kth.se/holdshelfno/api/v1/[userid]/[additionalID]/?token=[xxxxxxxxxxxxxx]"

Ange alma user id(email utan "@kth.se): testtl
Ange additional ID: 216-464-549-8
Byt ut xxxx mot rätt token

Exempel på svar:
```xml
<holdshelfnumber>
   <records>1</records>
   <holdshelfnumber>004</holdshelfnumber>
   <userid_encrypted>vhvjbqay</userid_encrypted>
</holdshelfnumber>
```

##### To Do

