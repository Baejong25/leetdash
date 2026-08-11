import java.util.HashSet;

class Solution {
    public boolean solution(String[] phone_book) {
//         Arrays.sort(phone_book);
//         for(int i = 0; i < phone_book.length - 1; i++) {
//             String a = phone_book[i];
//             String b = phone_book[i + 1];
//             if(a.length() > b.length())
//                 continue;
//             boolean answer = true;
            
//             for(int j = 0; j < a.length(); j++) {
//                 if(a.charAt(j) != b.charAt(j)) {
//                     answer = false;
//                     break;
//                 }
//             }
//             if(answer) {
//                 return false;
//             }
//         }
//         return true;
        
        HashSet<String> set = new HashSet<>();
        boolean answer = true;
        
        for (String s : phone_book) {
            set.add(s);
        }
        
        for (String s : phone_book) {
            for(int i = 1; i < s.length(); i++) {
                
                String same = s.substring(0, i);
                
                if(set.contains(same))
                    return false;
            }
        }
        
        return answer;
    }
}