import java.util.*; 
class Solution {
    public boolean solution(String[] phone_book) {
        // 접두사를 빨리 찾기 위해 HashSet 을 이용하자 
        HashSet <String> set = new HashSet<>(); 
        for (String phone : phone_book) {
            set.add(phone); 
        }
        
        for (String phone : phone_book) {
            for (int i = 1; i < phone.length(); i++) {
                String prefix = phone.substring(0, i); 
                if (set.contains(prefix)) {
                    return false;
                }
            }
            
        }
        return true;
        
    }
}