import java.util.*; 
class Solution {
    public String solution(int[] numbers) {
        // (0) 문자열 합치는 StringBuilder 
        StringBuilder sb = new StringBuilder(); 
        
        // (1) 정수 배열 -> 문자열 리스트로 변환하기 
        List<String> list = new ArrayList<>(); 
        for (int i = 0; i < numbers.length; i++) {
            list.add(String.valueOf(numbers[i])); 
        }
        
        // 내림차순 정렬 
        Collections.sort(list, (a,b) -> {
            String first = a + b;
            String second = b + a;
            return second.compareTo(first);
        }); 
        
        if (list.get(0).equals("0")) {
            return "0"; 
        }
       
        
        for (String snum : list){
            sb.append(snum); 
        }
        
      
        return sb.toString(); 
    }
}